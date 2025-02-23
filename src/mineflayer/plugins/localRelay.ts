import { viewerConnector } from 'mcraft-fun-mineflayer'
import { PACKETS_REPLAY_FILE_EXTENSION, WORLD_STATE_FILE_EXTENSION } from 'mcraft-fun-mineflayer/build/worldState'
import { Bot } from 'mineflayer'
import CircularBuffer from 'flying-squid/dist/circularBuffer'
import { PacketsLogger } from 'mcraft-fun-mineflayer/build/packetsLogger'

export const localRelayServerPlugin = (bot: Bot) => {
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
  bot._client.on('writePacket' as any, (name, params) => {
    circularBuffer!.add({ name, params, isFromServer: false })
  })
  bot._client.on('packet', (data, { name }) => {
    circularBuffer!.add({ name, params: data, isFromServer: true })
  })
}

declare module 'mineflayer' {
  interface Bot {
    downloadCurrentWorldState: () => void
  }
}

const AUTO_CAPTURE_PACKETS_COUNT = 30
let circularBuffer: CircularBuffer | undefined

export const getLastAutoCapturedPackets = () => circularBuffer?.size
export const downloadAutoCapturedPackets = () => {
  const logger = new PacketsLogger()
  for (const packet of circularBuffer?.getLastElements() ?? []) {
    logger.log(packet.isFromServer, packet.name, packet.params)
  }
  const textContents = logger.contents
  const blob = new Blob([textContents], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bot.username}-auto-captured-packets.txt`
  a.click()
  URL.revokeObjectURL(url)
}
