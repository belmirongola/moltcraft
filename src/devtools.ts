// global variables useful for debugging

import fs from 'fs'
import { WorldRendererThree } from 'renderer/viewer/lib/worldrendererThree'
import { enable, disable, enabled } from 'debug'
import { getEntityCursor } from './worldInteractions'

window.cursorBlockRel = (x = 0, y = 0, z = 0) => {
  const newPos = bot.blockAtCursor(5)?.position.offset(x, y, z)
  if (!newPos) return
  return bot.world.getBlock(newPos)
}

window.cursorEntity = () => {
  return getEntityCursor()
}

// wanderer
window.inspectPlayer = () => require('fs').promises.readFile('/world/playerdata/9e487d23-2ffc-365a-b1f8-f38203f59233.dat').then(window.nbt.parse).then(console.log)

Object.defineProperty(window, 'debugSceneChunks', {
  get () {
    return (viewer.world as WorldRendererThree).getLoadedChunksRelative?.(bot.entity.position, true)
  },
})

window.len = (obj) => Object.keys(obj).length

customEvents.on('gameLoaded', () => {
  bot._client.on('packet', (data, { name }) => {
    if (sessionStorage.ignorePackets?.includes(name)) {
      console.log('ignoring packet', name)
      const oldEmit = bot._client.emit
      let i = 0
      // ignore next 3 emits
      //@ts-expect-error
      bot._client.emit = (...args) => {
        if (i++ === 3) {
          oldEmit.apply(bot._client, args)
          bot._client.emit = oldEmit
        }
      }
    }
  })
})

window.inspectPacket = (packetName, isFromClient = false, fullOrListener: boolean | ((...args) => void) = false) => {
  const listener = typeof fullOrListener === 'function'
    ? (name, ...args) => fullOrListener(name, ...args)
    : (name, ...args) => {
      const displayName = name === packetName ? name : `${name} (${packetName})`
      console.log('packet', displayName, fullOrListener ? args : args[0])
    }

  // Pre-compile regex if using wildcards
  const pattern = typeof packetName === 'string' && packetName.includes('*')
    ? new RegExp('^' + packetName.replaceAll('*', '.*') + '$')
    : null

  const packetsListener = (name, data) => {
    if (pattern) {
      if (pattern.test(name)) {
        listener(name, data)
      }
    } else if (name === packetName) {
      listener(name, data)
    }
  }

  const attach = () => {
    if (isFromClient) {
      bot?._client.prependListener('writePacket', packetsListener)
    } else {
      bot?._client.prependListener('packet_name', packetsListener)
    }
  }
  const detach = () => {
    if (isFromClient) {
      bot?._client.removeListener('writePacket', packetsListener)
    } else {
      bot?._client.removeListener('packet_name', packetsListener)
    }
  }
  attach()
  customEvents.on('mineflayerBotCreated', attach)

  const returnobj = {}
  Object.defineProperty(returnobj, 'detach', {
    get () {
      detach()
      customEvents.removeListener('mineflayerBotCreated', attach)
      return true
    },
  })
  return returnobj
}

window.downloadFile = async (path: string) => {
  if (!path.startsWith('/') && localServer) path = `${localServer.options.worldFolder}/${path}`
  const data = await fs.promises.readFile(path)
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = path.split('/').at(-1)!
  a.click()
  URL.revokeObjectURL(url)
}

Object.defineProperty(window, 'debugToggle', {
  get () {
    localStorage.debug = localStorage.debug === '*' ? '' : '*'
    if (enabled('*')) {
      disable()
      return 'disabled debug'
    } else {
      enable('*')
      return 'enabled debug'
    }
  },
  set (v) {
    enable(v)
    localStorage.debug = v
    console.log('Enabled debug for', v)
  }
})
