/* eslint-disable no-restricted-globals */
import './protocolWorkerGlobals'
import * as net from 'net'
import EventEmitter from 'events'
import { Duplex } from 'stream'
import { Client, createClient } from 'minecraft-protocol'
import protocolMicrosoftAuth from 'minecraft-protocol/src/client/microsoftAuth'
import { createWorkerProxy } from 'renderer/viewer/lib/workerProxy'
import { validatePacket } from '../mineflayer/minecraft-protocol-extra'
import { getWebsocketStream } from '../mineflayer/websocket-core'

// This is a Web Worker for handling minecraft connection: protocol packet serialization/deserialization

// TODO: use another strategy by sending all events instead
const REDIRECT_EVENTS = ['connection', 'listening', 'playerJoin', 'connect_allowed', 'connect']
const REIDRECT_EVENTS_WITH_ARGS = ['end', 'playerChat', 'systemChat', 'state']
const ENABLE_TRANSFER = false

const emitEvent = (event: string, ...args: any[]) => {
  const transfer = ENABLE_TRANSFER ? args.filter(arg => arg instanceof ArrayBuffer || arg instanceof MessagePort || arg instanceof ImageBitmap || arg instanceof OffscreenCanvas || arg instanceof ImageData) : []
  self.postMessage({ type: 'event', event, args }, transfer as any)
}
let client: Client
const registeredChannels = [] as string[]
let skipWriteLog = false

type ProtocolWorkerInitOptions = {
  options: any
  noPacketsValidation: boolean
  useAuthFlow: boolean
  isWebSocket: boolean
}

let clientCreationPromise: Promise<void> | undefined
let lastKnownKickReason: string | undefined
export const PROXY_WORKER_TYPE = createWorkerProxy({
  setProxy (data: { hostname: string, port: number | undefined }) {
    console.log('[protocolWorker] using proxy', data)
    net['setProxy']({
      hostname: data.hostname,
      port: data.port
    })
  },
  async init ({ options, noPacketsValidation, useAuthFlow, isWebSocket }: ProtocolWorkerInitOptions) {
    if (client) throw new Error('Client already initialized')
    const withResolvers = Promise.withResolvers<void>()
    clientCreationPromise = withResolvers.promise

    // let stream: Duplex | undefined
    if (isWebSocket) {
      options.stream = (await getWebsocketStream(options.host)).mineflayerStream
    }

    await globalThis._LOAD_MC_DATA()
    if (useAuthFlow) {
      options.auth = authFlowWorkerThread
    }
    client = createClient(options)

    for (const event of REDIRECT_EVENTS) {
      client.on(event, () => {
        emitEvent(event)
      })
    }

    for (const event of REIDRECT_EVENTS_WITH_ARGS) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      client.on(event, (...args) => {
        if (event === 'end') {
          if (args[0] === 'socketClosed') {
            args[0] = lastKnownKickReason || 'Connection with proxy server has been lost'
          }
        }
        emitEvent(event, ...args)
      })
    }

    const oldWrite = client.write
    client.write = (...args) => {
      if (!skipWriteLog) {
        emitEvent('writePacket', ...args)
      }
      return oldWrite.apply(client, args)
    }

    client.on('packet', (data, packetMeta, buffer, fullBuffer) => {
      if (window.stopPacketsProcessing) return
      if (!noPacketsValidation) {
        validatePacket(packetMeta.name, data, fullBuffer, true)
      }
      emitEvent('packet', data, packetMeta, {}, { byteLength: fullBuffer.byteLength })
    })

    if (isWebSocket) {
      client.emit('connect')
    }

    wrapClientSocket(client)
    setupPropertiesSync(client)
    withResolvers.resolve()
    debugAnalyzeNeededProperties(client)
    clientCreationPromise = undefined
  },
  call (data: { name: string, args: any[] }) {
    // ignore sending back data
    const inner = async () => {
      await clientCreationPromise
      if (data.name === 'write') {
        skipWriteLog = true
      }
      client[data.name].bind(client)(...data.args)

      if (data.name === 'registerChannel' && !registeredChannels.includes(data.args[0])) {
        client.on(data.args[0], (...args: any[]) => {
          emitEvent(data.args[0], ...args)
        })
        registeredChannels.push(data.args[0])
      }
    }
    void inner()
  },

  async pingProxy (number: number) {
    return new Promise<number>((resolve) => {
      (client.socket as any)._ws.send(`ping:${number}`)
      const date = Date.now()
      const onPong = (received) => {
        if (received !== number.toString()) return
        client.socket.off('pong' as any, onPong)
        resolve(Date.now() - date)
      }
      client.socket.on('pong' as any, onPong)
    })
  }
})

const authFlowWorkerThread = async (client, options) => {
  self.postMessage({
    type: 'authFlow',
    version: client.version,
    username: client.username
  })
  options.onMsaCode = (data) => {
    self.postMessage({
      type: 'msaCode',
      data
    })
  }

  client.authflow = {
    async getMinecraftJavaToken () {
      return new Promise(resolve => {
        self.addEventListener('message', async (e) => {
          if (e.data.type === 'authflowResult') {
            const restoredData = await restoreData(e.data.data)
            if (restoredData?.certificates?.profileKeys?.privatePEM) {
              restoredData.certificates.profileKeys.private = restoredData.certificates.profileKeys.privatePEM
            }
            resolve(restoredData)
          }
        })
      })
    }
  }
  await Promise.race([
    protocolMicrosoftAuth.authenticate(client, options),
    // new Promise((_r, reject) => {
    //   signInMessageState.abortController.signal.addEventListener('abort', () => {
    //     reject(new UserError('Aborted by user'))
    //   })
    // })
  ])
}

// restore dates from strings
const restoreData = async (json) => {
  const promises = [] as Array<Promise<void>>
  if (typeof json === 'object' && json) {
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === 'string') {
        promises.push(tryRestorePublicKey(value, key, json))
        if (value.endsWith('Z')) {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            json[key] = date
          }
        }
      }
      if (typeof value === 'object') {
        // eslint-disable-next-line no-await-in-loop
        await restoreData(value)
      }
    }
  }

  await Promise.all(promises)

  return json
}

const tryRestorePublicKey = async (value: string, name: string, parent: { [x: string]: any }) => {
  value = value.trim()
  if (!name.endsWith('PEM') || !value.startsWith('-----BEGIN RSA PUBLIC KEY-----') || !value.endsWith('-----END RSA PUBLIC KEY-----')) return
  const der = pemToArrayBuffer(value)
  const key = await window.crypto.subtle.importKey(
    'spki', // Specify that the data is in SPKI format
    der,
    {
      name: 'RSA-OAEP',
      hash: { name: 'SHA-256' }
    },
    true,
    ['encrypt'] // Specify key usages
  )
  const originalName = name.replace('PEM', '')
  const exported = await window.crypto.subtle.exportKey('spki', key)
  const exportedBuffer = new Uint8Array(exported)
  parent[originalName] = {
    export () {
      return exportedBuffer
    }
  }
}

function pemToArrayBuffer (pem) {
  // Fetch the part of the PEM string between header and footer
  const pemHeader = '-----BEGIN RSA PUBLIC KEY-----'
  const pemFooter = '-----END RSA PUBLIC KEY-----'
  const pemContents = pem.slice(pemHeader.length, pem.length - pemFooter.length).trim()
  const binaryDerString = atob(pemContents.replaceAll(/\s/g, ''))
  const binaryDer = new Uint8Array(binaryDerString.length)
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.codePointAt(i)!
  }
  return binaryDer.buffer
}

const syncProperties = [
  'version',
  'username',
  'uuid',
  'ended',
  'latency',
  'isServer'
]

const setupPropertiesSync = (obj) => {
  sendProperties(obj, syncProperties)
}

const sendProperties = (obj: any, properties: string[]) => {
  try {
    const sendObj = {}
    for (const property of properties) {
      sendObj[property] = obj[property]
    }
    self.postMessage({ type: 'properties', properties: sendObj })
  } catch (err) {
    // fallback to individual property send
    for (const property of properties) {
      try {
        self.postMessage({ type: 'properties', properties: { [property]: obj[property] } })
      } catch (err) {
        console.error('Failed to sync property (from worker)', property, err)
      }
    }
  }
}

const expectedProperties = new Set([
  'version',
])

const debugAnalyzeNeededProperties = (obj) => {
  const dummyEventEmitter = new EventEmitter()
  const dummyEventEmitterPrototype = Object.getPrototypeOf(dummyEventEmitter)
  const redundantProperties = Object.getOwnPropertyNames(obj).filter(property => !expectedProperties.has(property) && !(property in dummyEventEmitterPrototype))
  // console.log('redundantProperties', redundantProperties)
}

const wrapClientSocket = (client: Client) => {
  const setupConnectHandlers = () => {
    net.Socket.prototype['handleStringMessage'] = function (message: string) {
      if (message.startsWith('proxy-message') || message.startsWith('proxy-command:')) { // for future
        return false
      }
      if (message.startsWith('proxy-shutdown:')) {
        lastKnownKickReason = message.slice('proxy-shutdown:'.length)
        return false
      }
      return true
    }
    client.socket.on('connect', () => {
      console.log('Proxy WebSocket connection established')
      //@ts-expect-error
      client.socket._ws.addEventListener('close', () => {
        console.log('WebSocket connection closed')
        // TODO important: for some reason close event of socket is never triggered now!
        setTimeout(() => {
          client.emit('end', lastKnownKickReason || 'WebSocket connection closed with unknown reason')
        }, 500)
      })
      client.socket.on('close', () => {
        setTimeout(() => {
          client.emit('end', lastKnownKickReason || 'WebSocket connection closed with unknown reason')
        })
      })
    })
  }
  // socket setup actually can be delayed because of dns lookup
  if (client.socket) {
    setupConnectHandlers()
  } else {
    const originalSetSocket = client.setSocket.bind(client)
    client.setSocket = (socket) => {
      originalSetSocket(socket)
      setupConnectHandlers()
    }
  }
}
