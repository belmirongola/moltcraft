/* eslint-disable no-restricted-globals */
import './protocolWorkerGlobals'
import * as net from 'net'
import { Client, createClient } from 'minecraft-protocol'
import protocolMicrosoftAuth from 'minecraft-protocol/src/client/microsoftAuth'
import { validatePacket } from '../mineflayer/minecraft-protocol-extra'

// This is a Web Worker for handling protocol-related tasks
// Respond to messages from the main thread
self.onmessage = (e) => {
  const handler = handlers[e.data.type]
  if (handler) {
    handler(e.data)
  }
}

const REDIRECT_EVENTS = ['connection', 'listening', 'playerJoin', 'end']
const ENABLE_TRANSFER = false

const emitEvent = (event: string, ...args: any[]) => {
  const transfer = ENABLE_TRANSFER ? args.filter(arg => arg instanceof ArrayBuffer || arg instanceof MessagePort || arg instanceof ImageBitmap || arg instanceof OffscreenCanvas || arg instanceof ImageData) : []
  self.postMessage({ type: 'event', event, args }, transfer as any)
}
let client: Client
const registeredChannels = [] as string[]

const handlers = {
  setProxy (data: { hostname: string, port: number }) {
    console.log('[protocolWorker] using proxy', data)
    net['setProxy']({ hostname: data.hostname, port: data.port })
  },
  async init ({ options, noPacketsValidation, useAuthFlow }: { options: any, noPacketsValidation: boolean, useAuthFlow: boolean }) {
    if (client) throw new Error('Client already initialized')
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

    client.on('packet', (data, packetMeta, buffer, fullBuffer) => {
      if (!noPacketsValidation) {
        validatePacket(packetMeta.name, data, fullBuffer, true)
      }
      emitEvent('packet', data, packetMeta, {}, { byteLength: fullBuffer.byteLength })
    })
  },
  call (data: { name: string, args: any[] }) {
    client[data.name].bind(client)(...data.args)
    if (data.name === 'registerChannel' && !registeredChannels.includes(data.args[0])) {
      client.on(data.args[0], (...args: any[]) => {
        emitEvent(data.args[0], ...args)
      })
      registeredChannels.push(data.args[0])
    }
  }
}

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
