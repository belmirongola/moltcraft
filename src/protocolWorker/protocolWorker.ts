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

const handlers = {
  setProxy (data: { hostname: string, port: number }) {
    console.log('[protocolWorker] using proxy', data)
    net['setProxy']({ hostname: data.hostname, port: data.port })
  },
  async init ({ options, noPacketsValidation }: { options: any, noPacketsValidation: boolean }) {
    if (client) throw new Error('Client already initialized')
    await globalThis._LOAD_MC_DATA()
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
  }
}

export const authFlowWorkerThread = async (options, client) => {
  self.postMessage({
    type: 'authFlow',
    version: client.version
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
        self.on('message', (e) => {
          if (e.data.type === 'msaCode') {
            resolve(e.data.data)
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
