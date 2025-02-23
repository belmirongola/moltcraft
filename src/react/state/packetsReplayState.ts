import { proxy } from 'valtio'
import type { PacketData } from '../ReplayPanel'
import { appQueryParams } from '../../appParams'

export const packetsReplayState = proxy({
  packetsPlayback: [] as PacketData[],
  isOpen: false,
  replayName: '',
  isPlaying: false,
  progress: {
    current: 0,
    total: 0
  },
  speed: appQueryParams.replaySpeed ? parseFloat(appQueryParams.replaySpeed) : 1,
  customButtons: {
    button1: false,
    button2: false
  }
})
