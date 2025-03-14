import EventEmitter from 'events'
import { ClientOptions } from 'minecraft-protocol'
import { appQueryParams } from '../appParams'
import { ConnectOptions } from '../connect'
import { setLoadingScreenStatus } from '../appStatus'
import { authFlowMainThread, getAuthData } from './microsoftAuthflow'

const debug = require('debug')('minecraft-protocol')

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

export const getProtocolClientGetter = async (proxy: { host: string, port?: string }, connectOptions: ConnectOptions, serverIp: string) => {
  const cachedTokens = typeof connectOptions.authenticatedAccount === 'object' ? connectOptions.authenticatedAccount.cachedTokens : {}
  const authData = connectOptions.authenticatedAccount ?
    await getAuthData({
      tokenCaches: cachedTokens,
      proxyBaseUrl: connectOptions.proxy,
      setProgressText (text) {
        setLoadingScreenStatus(text)
      },
      connectingServer: serverIp.replace(/:25565$/, '')
    })
    : undefined

  function createMinecraftProtocolClient (this: any) {
    if (!this.brand) return // brand is not resolved yet
    if (bot?._client) return bot._client
    const createClientOptions = copyPrimitiveValues(this, false, ['client']) as ClientOptions

    createClientOptions.sessionServer = authData?.sessionEndpoint.toString()

    const worker = new Worker(new URL('./protocolWorker.ts', import.meta.url))
    setTimeout(() => {
      if (bot) {
        bot.on('end', () => {
          worker.terminate()
        })
      } else {
        worker.terminate()
      }
    })

    worker.postMessage({
      type: 'setProxy',
      hostname: proxy.host,
      port: proxy.port
    })
    worker.postMessage({
      type: 'init',
      options: createClientOptions,
      noPacketsValidation: appQueryParams.noPacketsValidation,
      useAuthFlow: !!authData
    })

    const eventEmitter = new EventEmitter() as any
    eventEmitter.version = this.version

    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'event') {
        eventEmitter.emit(data.event, ...data.args)
        if (data.event === 'packet') {
          if (window.stopPacketsProcessing) return
          let [packetData, packetMeta] = data.args

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
    })

    eventEmitter.on('writePacket', (...args: any[]) => {
      debug(`SEND ${eventEmitter.state}:${args[0]}`, ...args.slice(1))
    })

    const redirectMethodsToWorker = (names: string[]) => {
      for (const name of names) {
        eventEmitter[name] = async (...args: any[]) => {
          worker.postMessage({
            type: 'call',
            name,
            args: JSON.parse(JSON.stringify(args))
          })

          if (name === 'write') {
            eventEmitter.emit('writePacket', ...args)
          }
        }
      }
    }

    redirectMethodsToWorker(['write', 'registerChannel', 'writeChannel'])

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
