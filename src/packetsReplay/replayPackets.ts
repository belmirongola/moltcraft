/* eslint-disable no-await-in-loop */
import { createServer, ServerClient } from 'minecraft-protocol'
import { parseReplayContents } from 'mcraft-fun-mineflayer/build/packetsLogger'
import { WorldStateHeader, PACKETS_REPLAY_FILE_EXTENSION, WORLD_STATE_FILE_EXTENSION } from 'mcraft-fun-mineflayer/build/worldState'
import { LocalServer } from '../customServer'
import { UserError } from '../mineflayer/userError'
import { packetsReplayState } from '../react/state/packetsReplayState'
import { getFixedFilesize } from '../react/simpleUtils'
import { appQueryParams } from '../appParams'

const SUPPORTED_FORMAT_VERSION = 1

type ReplayDefinition = {
  minecraftVersion: string
  replayAgainst?: 'client' | 'server'
  serverIp?: string
}

interface OpenFileOptions {
  contents: string
  filename?: string
  filesize?: number
}

export function openFile ({ contents, filename = 'unnamed', filesize }: OpenFileOptions) {
  packetsReplayState.replayName = `${filename} (${getFixedFilesize(filesize ?? contents.length)})`
  packetsReplayState.isOpen = true
  packetsReplayState.isPlaying = false

  const connectOptions = {
    worldStateFileContents: contents,
    username: 'replay'
  }
  dispatchEvent(new CustomEvent('connect', { detail: connectOptions }))
}

export const startLocalReplayServer = (contents: string) => {
  const lines = contents.split('\n')
  if (!lines[0]) {
    throw new UserError('No header line found. Cannot parse replay definition.')
  }
  let def: WorldStateHeader | ReplayDefinition
  try {
    def = JSON.parse(lines[0])
  } catch (err) {
    throw new UserError(`Invalid JSON in file header: ${String(err)}`)
  }
  const packetsRaw = lines.slice(1).join('\n')
  const replayData = parseReplayContents(packetsRaw)

  packetsReplayState.packetsPlayback = []
  packetsReplayState.isOpen = true
  packetsReplayState.isPlaying = true
  packetsReplayState.progress = {
    current: 0,
    total: replayData.packets.filter(packet => packet.isFromServer).length
  }
  packetsReplayState.speed = 1
  packetsReplayState.replayName ||= `local ${getFixedFilesize(contents.length)}`
  packetsReplayState.replayName = `${def.minecraftVersion} ${packetsReplayState.replayName}`

  if ('formatVersion' in def && def.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new UserError(`Unsupported format version: ${def.formatVersion}`)
  }
  if ('replayAgainst' in def && def.replayAgainst === 'server') {
    throw new Error('not supported')
  }

  const server = createServer({
    Server: LocalServer as any,
    version: def.minecraftVersion,
    'online-mode': false
  })

  server.on('login', async client => {
    await mainPacketsReplayer(
      client,
      replayData,
      appQueryParams.replayValidateClient === 'true' ? true : undefined
    )
  })

  return {
    server,
    version: def.minecraftVersion
  }
}

// time based packets
// const FLATTEN_CLIENT_PACKETS = new Set(['position', 'position_look'])
const FLATTEN_CLIENT_PACKETS = new Set([] as string[])

const positions = {
  client: 0,
  server: 0
}
const addPacketToReplayer = (name: string, data, isFromClient: boolean, wasUpcoming = false) => {
  const side = isFromClient ? 'client' : 'server'

  if (wasUpcoming) {
    const lastUpcoming = packetsReplayState.packetsPlayback.find(p => p.isUpcoming && p.name === name)
    if (lastUpcoming) {
      lastUpcoming.isUpcoming = false
    }
  } else {
    packetsReplayState.packetsPlayback.push({
      name,
      data,
      isFromClient,
      position: ++positions[side]!,
      isUpcoming: false,
      timestamp: Date.now()
    })
  }

  if (!isFromClient && !wasUpcoming) {
    packetsReplayState.progress.current++
  }
}

const IGNORE_SERVER_PACKETS = new Set([
  'kick_disconnect',
])

const mainPacketsReplayer = async (client: ServerClient, replayData: ReturnType<typeof parseReplayContents>, ignoreClientPacketsWait: string[] | true = []) => {
  const writePacket = (name: string, data: any) => {
    data = restoreData(data)
    client.write(name, data)
  }

  const playPackets = replayData.packets.filter(p => p.state === 'play')

  let clientPackets = [] as Array<{ name: string, params: any }>
  const clientsPacketsWaiter = createPacketsWaiter({
    unexpectedPacketReceived (name, params) {
      console.log('unexpectedPacketReceived', name, params)
      addPacketToReplayer(name, params, true)
    },
    expectedPacketReceived (name, params) {
      console.log('expectedPacketReceived', name, params)
      addPacketToReplayer(name, params, true, true)
    }
  })
  bot._client.on('writePacket' as any, (name, params) => {
    console.log('writePacket', name, params)
    clientsPacketsWaiter.addPacket(name, params)
  })

  console.log('start replaying!')
  for (const [i, packet] of playPackets.entries()) {
    if (packet.isFromServer) {
      writePacket(packet.name, packet.params)
      addPacketToReplayer(packet.name, packet.params, false)
      await new Promise(resolve => {
        setTimeout(resolve, packet.diff * packetsReplayState.speed)
      })
    } else if (ignoreClientPacketsWait !== true && !ignoreClientPacketsWait.includes(packet.name)) {
      clientPackets.push({ name: packet.name, params: packet.params })
      if (playPackets[i + 1]?.isFromServer) {
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        clientPackets = clientPackets.filter((p, index) => {
          return !FLATTEN_CLIENT_PACKETS.has(p.name) || index === clientPackets.findIndex(clientPacket => clientPacket.name === p.name)
        })
        for (const packet of clientPackets) {
          packetsReplayState.packetsPlayback.push({
            name: packet.name,
            data: packet.params,
            isFromClient: true,
            position: positions.client++,
            timestamp: Date.now(),
            isUpcoming: true,
          })
        }

        await clientsPacketsWaiter.waitForPackets(clientPackets.map(p => p.name))
        clientPackets = []
      }
    }
  }
}

interface PacketsWaiterOptions {
  unexpectedPacketReceived?: (name: string, params: any) => void
  expectedPacketReceived?: (name: string, params: any) => void
}

interface PacketsWaiter {
  addPacket(name: string, params: any): void
  waitForPackets(packets: string[]): Promise<void>
}

const createPacketsWaiter = (options: PacketsWaiterOptions = {}): PacketsWaiter => {
  let packetHandler: ((data: any, name: string) => void) | null = null
  const queuedPackets: Array<{ name: string, params: any }> = []
  let isWaiting = false

  const handlePacket = (data: any, name: string, waitingPackets: string[], resolve: () => void) => {
    if (waitingPackets.includes(name)) {
      waitingPackets.splice(waitingPackets.indexOf(name), 1)
      options.expectedPacketReceived?.(name, data)
    } else {
      options.unexpectedPacketReceived?.(name, data)
    }

    if (waitingPackets.length === 0) {
      resolve()
    }
  }

  return {
    addPacket (name: string, params: any) {
      if (packetHandler) {
        packetHandler(params, name)
      } else {
        queuedPackets.push({ name, params })
      }
    },

    async waitForPackets (packets: string[]) {
      if (isWaiting) {
        throw new Error('Already waiting for packets')
      }
      isWaiting = true

      try {
        await new Promise<void>(resolve => {
          const waitingPackets = [...packets]

          packetHandler = (data: any, name: string) => {
            handlePacket(data, name, waitingPackets, resolve)
          }

          // Process any queued packets
          for (const packet of queuedPackets) {
            handlePacket(packet.params, packet.name, waitingPackets, resolve)
          }
          queuedPackets.length = 0
        })
      } finally {
        isWaiting = false
        packetHandler = null
      }
    }
  }
}

const isArrayEqual = (a: any[], b: any[]) => {
  if (a.length !== b.length) return false
  for (const [i, element] of a.entries()) {
    if (element !== b[i]) return false
  }
  return true
}

const restoreData = (json: any) => {
  const keys = Object.keys(json)

  if (isArrayEqual(keys.sort(), ['data', 'type'].sort())) {
    if (json.type === 'Buffer') {
      return Buffer.from(json.data)
    }
  }

  if (typeof json === 'object' && json) {
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === 'object') {
        json[key] = restoreData(value)
      }
    }
  }

  return json
}

export const VALID_REPLAY_EXTENSIONS = [`.${PACKETS_REPLAY_FILE_EXTENSION}`, `.${WORLD_STATE_FILE_EXTENSION}`]
