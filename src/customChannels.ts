import { Vec3 } from 'vec3'
import { getThreeJsRendererMethods } from 'renderer/viewer/three/threeJsMethods'
import { options } from './optionsStorage'

customEvents.on('mineflayerBotCreated', async () => {
  if (!options.customChannels) return
  await new Promise(resolve => {
    bot.once('login', () => {
      resolve(true)
    })
  })
  registerBlockModelsChannel()
})

const registerChannel = (channelName: string, packetStructure: any[], handler: (data: any) => void, waitForWorld = true) => {
  bot._client.registerChannel(channelName, packetStructure, true)
  bot._client.on(channelName as any, async (data) => {
    if (waitForWorld) {
      await appViewer.worldReady
      handler(data)
    } else {
      handler(data)
    }
  })

  console.debug(`registered custom channel ${channelName} channel`)
}

const registerBlockModelsChannel = () => {
  const CHANNEL_NAME = 'minecraft-web-client:blockmodels'

  const packetStructure = [
    'container',
    [
      {
        name: 'worldName', // currently not used
        type: ['pstring', { countType: 'i16' }]
      },
      {
        name: 'x',
        type: 'i32'
      },
      {
        name: 'y',
        type: 'i32'
      },
      {
        name: 'z',
        type: 'i32'
      },
      {
        name: 'model',
        type: ['pstring', { countType: 'i16' }]
      }
    ]
  ]

  registerChannel(CHANNEL_NAME, packetStructure, (data) => {
    const { worldName, x, y, z, model } = data

    const chunkX = Math.floor(x / 16) * 16
    const chunkZ = Math.floor(z / 16) * 16
    const chunkKey = `${chunkX},${chunkZ}`
    const blockPosKey = `${x},${y},${z}`

    getThreeJsRendererMethods()?.updateCustomBlock(chunkKey, blockPosKey, model)
  }, true)
}

const registeredJeiChannel = () => {
  const CHANNEL_NAME = 'minecraft-web-client:jei'
  // id - string, categoryTitle - string, items - string (json array)
  const packetStructure = [
    'container',
    [
      {
        name: 'id',
        type: ['pstring', { countType: 'i16' }]
      },
      {
        name: 'categoryTitle',
        type: ['pstring', { countType: 'i16' }]
      },
      {
        name: 'items',
        type: ['pstring', { countType: 'i16' }]
      },
    ]
  ]

  bot._client.registerChannel(CHANNEL_NAME, packetStructure, true)

  bot._client.on(CHANNEL_NAME as any, (data) => {
    const { id, categoryTitle, items } = data
    // ...
  })

  console.debug(`registered custom channel ${CHANNEL_NAME} channel`)
}
