import { subscribeKey } from 'valtio/utils'
import { options } from './optionsStorage'
import { isCypress } from './standaloneUtils'
import { reportWarningOnce } from './utils'

let audioContext: AudioContext
const sounds: Record<string, any> = {}

// Track currently playing sounds and their gain nodes
const activeSounds: Array<{ source: AudioBufferSourceNode; gainNode: GainNode; volumeMultiplier: number }> = []
window.activeSounds = activeSounds

// load as many resources on page load as possible instead on demand as user can disable internet connection after he thinks the page is loaded
const loadingSounds = [] as string[]
const convertedSounds = [] as string[]

export async function loadSound (path: string, contents = path) {
  if (loadingSounds.includes(path)) return true
  loadingSounds.push(path)

  try {
    audioContext ??= new window.AudioContext()

    const res = await window.fetch(contents)
    if (!res.ok) {
      const error = `Failed to load sound ${path}`
      if (isCypress()) throw new Error(error)
      else console.warn(error)
      return
    }
    const arrayBuffer = await res.arrayBuffer()

    // Decode the audio data immediately
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    sounds[path] = audioBuffer
    convertedSounds.push(path) // Mark as converted immediately

    loadingSounds.splice(loadingSounds.indexOf(path), 1)
  } catch (err) {
    console.warn(`Failed to load sound ${path}:`, err)
    loadingSounds.splice(loadingSounds.indexOf(path), 1)
    if (isCypress()) throw err
  }
}

export const loadOrPlaySound = async (url, soundVolume = 1, loadTimeout = 500) => {
  const soundBuffer = sounds[url]
  if (!soundBuffer) {
    const start = Date.now()
    const cancelled = await loadSound(url)
    if (cancelled || Date.now() - start > loadTimeout) return
  }

  return playSound(url, soundVolume)
}

export async function playSound (url, soundVolume = 1) {
  const volume = soundVolume * (options.volume / 100)

  if (!volume) return

  try {
    audioContext ??= new window.AudioContext()
  } catch (err) {
    reportWarningOnce('audioContext', 'Failed to create audio context. Some sounds will not play')
    return
  }

  const soundBuffer = sounds[url]
  if (!soundBuffer) {
    console.warn(`Sound ${url} not loaded yet`)
    return
  }

  const gainNode = audioContext.createGain()
  const source = audioContext.createBufferSource()
  source.buffer = soundBuffer
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)
  gainNode.gain.value = volume
  source.start(0)

  // Add to active sounds
  activeSounds.push({ source, gainNode, volumeMultiplier: soundVolume })

  const callbacks = [] as Array<() => void>
  source.onended = () => {
    // Remove from active sounds when finished
    const index = activeSounds.findIndex(s => s.source === source)
    if (index !== -1) activeSounds.splice(index, 1)

    for (const callback of callbacks) {
      callback()
    }
    callbacks.length = 0
  }

  return {
    onEnded (callback: () => void) {
      callbacks.push(callback)
    },
  }
}

export function stopAllSounds () {
  for (const { source } of activeSounds) {
    try {
      source.stop()
    } catch (err) {
      console.warn('Failed to stop sound:', err)
    }
  }
  activeSounds.length = 0
}

export function changeVolumeOfCurrentlyPlayingSounds (newVolume: number) {
  const normalizedVolume = newVolume / 100
  for (const { gainNode, volumeMultiplier } of activeSounds) {
    try {
      gainNode.gain.value = normalizedVolume * volumeMultiplier
    } catch (err) {
      console.warn('Failed to change sound volume:', err)
    }
  }
}

subscribeKey(options, 'volume', () => {
  changeVolumeOfCurrentlyPlayingSounds(options.volume)
})
