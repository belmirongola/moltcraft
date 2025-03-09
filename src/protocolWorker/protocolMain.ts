import EventEmitter from 'events'
import { appQueryParams } from '../appParams'

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

export const getProtocolClientGetter = (proxy: { host: string, port?: string }) => {
  function createMinecraftProtocolClient (this: any) {
    if (!this.brand) return // brand is not resolved yet
    if (bot?._client) return bot._client
    // if (singleplayer || p2pMultiplayer || localReplaySession) {
    //     return undefined
    // }
    const createClientOptions = copyPrimitiveValues(this, false, ['client'])
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
      noPacketsValidation: appQueryParams.noPacketsValidation
    })

    const eventEmitter = new EventEmitter() as any
    eventEmitter.version = this.version

    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'event') {
        eventEmitter.emit(data.event, ...data.args)
        if (data.event === 'packet') {
          let [packetData, packetMeta] = data.args

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
          eventEmitter.emit(packetMeta.name, packetData, packetMeta)
        }
      }
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
