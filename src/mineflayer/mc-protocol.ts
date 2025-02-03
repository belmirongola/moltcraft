import { Client } from 'minecraft-protocol'
import { appQueryParams } from '../appParams'
import { validatePacket } from './minecraft-protocol-extra'

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
