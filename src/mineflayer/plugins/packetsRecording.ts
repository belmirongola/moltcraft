import { viewerConnector } from 'mcraft-fun-mineflayer'
import { PACKETS_REPLAY_FILE_EXTENSION, WORLD_STATE_FILE_EXTENSION } from 'mcraft-fun-mineflayer/build/worldState'
import { Bot } from 'mineflayer'
import CircularBuffer from 'flying-squid/dist/circularBuffer'
import { PacketsLogger } from 'mcraft-fun-mineflayer/build/packetsLogger'
import { subscribe } from 'valtio'
import { lastConnectOptions } from '../../react/AppStatusProvider'
import { packetsRecordingState } from '../../packetsReplay/packetsReplayLegacy'
import { packetsReplayState } from '../../react/state/packetsReplayState'

const AUTO_CAPTURE_PACKETS_COUNT = 30
let circularBuffer: CircularBuffer | undefined
let lastConnectVersion = ''

export const localRelayServerPlugin = (bot: Bot) => {
  lastConnectVersion = bot.version
  let ended = false
  bot.on('end', () => {
    ended = true
  })

  bot.loadPlugin(
    viewerConnector({
      tcpEnabled: false,
      websocketEnabled: false,
    })
  )

  bot.downloadCurrentWorldState = () => {
    const worldState = bot.webViewer._unstable.createStateCaptureFile()
    const a = document.createElement('a')
    const textContents = worldState.contents
    const blob = new Blob([textContents], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    a.href = url
    // add readable timestamp to filename
    const timestamp = new Date().toISOString().replaceAll(/[-:Z]/g, '')
    a.download = `${bot.username}-world-state-${timestamp}.${WORLD_STATE_FILE_EXTENSION}`
    a.click()
    URL.revokeObjectURL(url)
  }

  circularBuffer = new CircularBuffer(AUTO_CAPTURE_PACKETS_COUNT)
  let position = 0
  bot._client.on('writePacket' as any, (name, params) => {
    circularBuffer!.add({ name, state: bot._client.state, params, isFromServer: false, timestamp: Date.now() })
    if (packetsRecordingState.active) {
      packetsReplayState.packetsPlayback.push({
        name,
        data: params,
        isFromClient: true,
        isUpcoming: false,
        position: position++,
        timestamp: Date.now(),
      })
    }
  })
  bot._client.on('packet', (data, { name }) => {
    if (name === 'map_chunk') data = { x: data.x, z: data.z }
    circularBuffer!.add({ name, state: bot._client.state, params: data, isFromServer: true, timestamp: Date.now() })
    if (packetsRecordingState.active) {
      packetsReplayState.packetsPlayback.push({
        name,
        data,
        isFromClient: false,
        isUpcoming: false,
        position: position++,
        timestamp: Date.now(),
      })
    }
  })

  upPacketsReplayPanel()
}

const upPacketsReplayPanel = () => {
  if (packetsRecordingState.active && bot) {
    packetsReplayState.isOpen = true
    packetsReplayState.replayName = 'Recording all packets for ' + bot.username
  }
}

subscribe(packetsRecordingState, () => {
  upPacketsReplayPanel()
})

declare module 'mineflayer' {
  interface Bot {
    downloadCurrentWorldState: () => void
  }
}

export const getLastAutoCapturedPackets = () => circularBuffer?.size
export const downloadAutoCapturedPackets = () => {
  const logger = new PacketsLogger({ minecraftVersion: lastConnectVersion })
  for (const packet of circularBuffer?.getLastElements() ?? []) {
    logger.log(packet.isFromServer, { name: packet.name, state: packet.state, time: packet.timestamp }, packet.params)
  }
  const textContents = logger.contents
  const blob = new Blob([textContents], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lastConnectOptions.value?.server ?? 'unknown-server'}-${lastConnectOptions.value?.username ?? 'unknown-username'}-auto-captured-packets.txt`
  a.click()
  URL.revokeObjectURL(url)
}
