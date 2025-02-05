import { Client } from 'minecraft-protocol'
import { appQueryParams } from '../appParams'
import { downloadAllMinecraftData, getVersionAutoSelect } from '../connect'
import { pingServerVersion, validatePacket } from './minecraft-protocol-extra'
import { getWebsocketStream } from './websocket-core'

customEvents.on('mineflayerBotCreated', () => {
  // todo move more code here
  if (!appQueryParams.noPacketsValidation) {
    (bot._client as unknown as Client).on('packet', (data, packetMeta, buffer, fullBuffer) => {
      validatePacket(packetMeta.name, data, fullBuffer, true)
    });
    (bot._client as unknown as Client).on('writePacket', (name, params) => {
      validatePacket(name, params, Buffer.alloc(0), false)
    })
  }
})


export const getServerInfo = async (ip: string, port?: number, preferredVersion = getVersionAutoSelect(), ping = false) => {
  await downloadAllMinecraftData()
  const isWebSocket = ip.startsWith('ws://') || ip.startsWith('wss://')
  let stream
  if (isWebSocket) {
    stream = (await getWebsocketStream(ip)).mineflayerStream
  }
  return pingServerVersion(ip, port, {
    ...(stream ? { stream } : {}),
    ...(ping ? { noPongTimeout: 3000 } : {}),
    ...(preferredVersion ? { version: preferredVersion } : {}),
  })
}
