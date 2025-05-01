import EventEmitter from 'events'
import { Client, ClientOptions } from 'minecraft-protocol'
import { useWorkerProxy } from 'renderer/viewer/lib/workerProxy'
import { appQueryParams } from '../appParams'
import { ConnectOptions } from '../connect'
import { setLoadingScreenStatus } from '../appStatus'
import { ParsedServerAddress } from '../parseServerAddress'
import { authFlowMainThread, getAuthData } from './microsoftAuthflow'
import type { PROXY_WORKER_TYPE } from './protocol.worker'

//@ts-expect-error
import ProtocolWorker from './protocol.worker.ts'

const debug = require('debug')('minecraft-protocol')

let protocolWorkerChannel: typeof PROXY_WORKER_TYPE['__workerProxy'] | undefined

export const getProtocolWorkerChannel = () => {
  return protocolWorkerChannel
}

const copyPrimitiveValues = (obj: any, deep = false, ignoreKeys: string[] = []) => {
  const copy = {} as Record<string, any>
  for (const key in obj) {
    if (ignoreKeys.includes(key)) continue
    if (typeof obj[key] === 'object' && obj[key] !== null && deep) {
      copy[key] = copyPrimitiveValues(obj[key])
    } else if (typeof obj[key] === 'number' || typeof obj[key] === 'string' || typeof obj[key] === 'boolean') {
      copy[key] = obj[key]
    }
  }
  return copy
}

export const getProtocolClientGetter = async (proxy: { host: string, port?: string }, connectOptions: ConnectOptions, server: ParsedServerAddress) => {
  const cachedTokens = typeof connectOptions.authenticatedAccount === 'object' ? connectOptions.authenticatedAccount.cachedTokens : {}
  const authData = connectOptions.authenticatedAccount ?
    await getAuthData({
      tokenCaches: cachedTokens,
      proxyBaseUrl: connectOptions.proxy,
      setProgressText (text) {
        setLoadingScreenStatus(text)
      },
      connectingServer: server.serverIpFull.replace(/:25565$/, '')
    })
    : undefined

  function createMinecraftProtocolClient (this: any) {
    if (!this.brand) return // brand is not resolved yet
    if (bot?._client) return bot._client
    const createClientOptions = copyPrimitiveValues(this, false, ['client']) as ClientOptions

    createClientOptions.sessionServer = authData?.sessionEndpoint.toString()

    const worker = new ProtocolWorker()
    protocolWorkerChannel = useWorkerProxy<typeof PROXY_WORKER_TYPE>(worker)
    setTimeout(() => {
      if (bot) {
        bot.on('end', () => {
          worker.terminate()
        })
      } else {
        worker.terminate()
      }
    })

    protocolWorkerChannel.setProxy({
      hostname: proxy.host,
      port: proxy.port ? +proxy.port : undefined
    })
    void protocolWorkerChannel.init({
      options: createClientOptions,
      noPacketsValidation: appQueryParams.noPacketsValidation === 'true',
      useAuthFlow: !!authData,
      isWebSocket: server.isWebSocket
    })

    const eventEmitter = new EventEmitter() as any
    eventEmitter.version = this.version

    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'event') {
        eventEmitter.emit(data.event, ...data.args)
        if (data.event === 'packet') {
          let [packetData, packetMeta] = data.args
          if (window.stopPacketsProcessing === true || (Array.isArray(window.stopPacketsProcessing) && window.stopPacketsProcessing.includes(packetMeta.name))) {
            if (window.skipPackets && !window.skipPackets.includes(packetMeta.name)) {
              return
            }
          }

          // Start timing the packet processing
          const startTime = performance.now()

          // restore transferred data
          if (packetData instanceof Uint8Array) {
            packetData = Buffer.from(packetData)
          } else if (typeof packetData === 'object' && packetData !== null) {
            // Deep patch any Uint8Array values in the packet data object
            const patchUint8Arrays = (obj: any) => {
              for (const key in obj) {
                if (obj[key] instanceof Uint8Array) {
                  obj[key] = Buffer.from(obj[key])
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                  patchUint8Arrays(obj[key])
                }
              }
            }
            patchUint8Arrays(packetData)
          }

          eventEmitter.state = packetMeta.state
          debug(`RECV ${eventEmitter.state}:${packetMeta.name}`, packetData)

          // Initialize packet timing tracking if not exists
          if (!window.packetTimings) {
            window.packetTimings = {}
          }

          if (!window.packetTimings[packetMeta.name]) {
            window.packetTimings[packetMeta.name] = {
              total: 0,
              count: 0,
              avg: 0
            }
          }

          eventEmitter.emit(packetMeta.name, packetData, packetMeta)

          // Calculate processing time
          const processingTime = performance.now() - startTime
          window.packetTimings[packetMeta.name].total += processingTime
          window.packetTimings[packetMeta.name].count++
          window.packetTimings[packetMeta.name].avg =
            window.packetTimings[packetMeta.name].total / window.packetTimings[packetMeta.name].count

          // Update packetsThreadBlocking every second
          if (!window.lastStatsUpdate) {
            window.lastStatsUpdate = Date.now()
            setInterval(() => {
              // Sort by total processing time
              window.packetsThreadBlocking = Object.entries(window.packetTimings)
                .sort(([, a], [, b]) => b.total - a.total)
                .reduce((acc, [key, value]) => {
                  acc[key] = value
                  return acc
                }, {})

              // Reset timings for next interval
              window.packetTimings = {}
              window.lastStatsUpdate = Date.now()
            }, 1000)
          }
        }
      }

      if (data.type === 'properties') {
        // eslint-disable-next-line guard-for-in
        for (const property in data.properties) {
          eventEmitter[property] = data.properties[property]
        }
      }
    })

    eventEmitter.on('writePacket', (...args: any[]) => {
      debug(`SEND ${eventEmitter.state}:${args[0]}`, ...args.slice(1))
    })

    const redirectMethodsToWorker = (names: string[]) => {
      for (const name of names) {
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        eventEmitter[name] = async (...args: any[]) => {
          protocolWorkerChannel?.call({
            name,
            args: JSON.parse(JSON.stringify(args))
          })

          if (name === 'write') {
            eventEmitter.emit('writePacket', ...args)
          }
        }
      }
    }

    redirectMethodsToWorker([
      'write',
      'writeRaw',
      'writeChannel',
      'registerChannel',
      'unregisterChannel',
      'chat',
      'reportPlayer',
      'end'
    ])

    if (authData) {
      void authFlowMainThread(worker, authData, connectOptions, (onJoin) => {
        eventEmitter.on('login', onJoin)
      })
    }

    return eventEmitter
    // return new Proxy(eventEmitter, {
    //   get (target, prop) {
    //     if (!(prop in target)) {
    //       // console.warn(`Accessing non-existent property "${String(prop)}" on event emitter`)
    //     }
    //     const value = target[prop]
    //     return typeof value === 'function' ? value.bind(target) : value
    //   }
    // })
  }
  return createMinecraftProtocolClient
}
