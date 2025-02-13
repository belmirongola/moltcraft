import { Vec3 } from 'vec3'
import { versionToNumber } from 'renderer/viewer/prepare/utils'
import { loadScript } from 'renderer/viewer/lib/utils'
import type { Block } from 'prismarine-block'
import { subscribeKey } from 'valtio/utils'
import { miscUiState } from '../globalState'
import { options } from '../optionsStorage'
import { loadOrPlaySound } from '../basicSounds'
import { getActiveResourcepackBasePath, resourcePackState } from '../resourcePack'
import { createSoundMap, SoundMap } from './soundsMap'
import { musicSystem } from './musicSystem'

let soundMap: SoundMap | undefined

const updateResourcePack = async () => {
  if (!soundMap) return
  soundMap.activeResourcePackBasePath = await getActiveResourcepackBasePath() ?? undefined
}

let musicInterval: ReturnType<typeof setInterval> | null = null

subscribeKey(miscUiState, 'gameLoaded', async () => {
  if (!miscUiState.gameLoaded || !loadedData.sounds) {
    stopMusicSystem()
    soundMap?.quit()
    return
  }

  console.log(`Loading sounds for version ${bot.version}. Resourcepack state: ${JSON.stringify(resourcePackState)}`)
  soundMap = createSoundMap(bot.version) ?? undefined
  if (!soundMap) return
  void updateResourcePack()
  startMusicSystem()

  const playGeneralSound = async (soundKey: string, position?: Vec3, volume = 1, pitch?: number) => {
    if (!options.volume || !soundMap) return
    const soundData = await soundMap.getSoundUrl(soundKey, volume)
    if (!soundData) return

    const isMuted = options.mutedSounds.includes(soundKey) || options.volume === 0
    if (position) {
      if (!isMuted) {
        viewer.playSound(
          position,
          soundData.url,
          soundData.volume * (options.volume / 100),
          Math.max(Math.min(pitch ?? 1, 2), 0.5)
        )
      }
      if (getDistance(bot.entity.position, position) < 4 * 16) {
        lastPlayedSounds.lastServerPlayed[soundKey] ??= { count: 0, last: 0 }
        lastPlayedSounds.lastServerPlayed[soundKey].count++
        lastPlayedSounds.lastServerPlayed[soundKey].last = Date.now()
      }
    } else {
      if (!isMuted) {
        await loadOrPlaySound(soundData.url, volume)
      }
      lastPlayedSounds.lastClientPlayed.push(soundKey)
      if (lastPlayedSounds.lastClientPlayed.length > 10) {
        lastPlayedSounds.lastClientPlayed.shift()
      }
    }
  }

  const musicStartCheck = async (force = false) => {
    if (!soundMap) return
    // 20% chance to start music
    if (Math.random() > 0.2 && !force && !options.enableMusic) return

    const musicKeys = ['music.game']
    if (bot.game.gameMode === 'creative') {
      musicKeys.push('music.creative')
    }
    const randomMusicKey = musicKeys[Math.floor(Math.random() * musicKeys.length)]
    const soundData = await soundMap.getSoundUrl(randomMusicKey)
    if (!soundData) return
    await musicSystem.playMusic(soundData.url, soundData.volume)
  }

  function startMusicSystem () {
    if (musicInterval) return
    musicInterval = setInterval(() => {
      void musicStartCheck()
    }, 10_000)
  }

  window.forceStartMusic = () => {
    void musicStartCheck(true)
  }


  function stopMusicSystem () {
    if (musicInterval) {
      clearInterval(musicInterval)
      musicInterval = null
    }
  }

  const playHardcodedSound = async (soundKey: string, position?: Vec3, volume = 1, pitch?: number) => {
    await playGeneralSound(soundKey, position, volume, pitch)
  }

  bot.on('soundEffectHeard', async (soundId, position, volume, pitch) => {
    await playHardcodedSound(soundId, position, volume, pitch)
  })

  bot.on('hardcodedSoundEffectHeard', async (soundIdNum, soundCategory, position, volume, pitch) => {
    const fixOffset = versionToNumber('1.20.4') === versionToNumber(bot.version) ? -1 : 0
    const soundKey = loadedData.sounds[soundIdNum + fixOffset]?.name
    if (soundKey === undefined) return
    await playGeneralSound(soundKey, position, volume, pitch)
  })

  bot._client.on('sound_effect', async (packet) => {
    const soundResource = packet['soundEvent']?.resource as string | undefined
    if (packet.soundId !== 0 || !soundResource) return
    const pos = new Vec3(packet.x / 8, packet.y / 8, packet.z / 8)
    await playHardcodedSound(soundResource.replace('minecraft:', ''), pos, packet.volume, packet.pitch)
  })

  bot.on('entityHurt', async (entity) => {
    if (entity.id === bot.entity.id) {
      await playHardcodedSound('entity.player.hurt')
    }
  })

  let lastStepSound = 0
  const movementHappening = async () => {
    if (!bot.player || !soundMap) return // no info yet
    const VELOCITY_THRESHOLD = 0.1
    const { x, z, y } = bot.player.entity.velocity
    if (bot.entity.onGround && Math.abs(x) < VELOCITY_THRESHOLD && (Math.abs(z) > VELOCITY_THRESHOLD || Math.abs(y) > VELOCITY_THRESHOLD)) {
      // movement happening
      if (Date.now() - lastStepSound > 300) {
        const blockUnder = bot.world.getBlock(bot.entity.position.offset(0, -1, 0))
        if (blockUnder) {
          const stepSound = soundMap.getStepSound(blockUnder.name)
          if (stepSound) {
            await playHardcodedSound(stepSound, undefined, 0.6)
            lastStepSound = Date.now()
          }
        }
      }
    }
  }

  const playBlockBreak = async (blockName: string, position?: Vec3) => {
    if (!soundMap) return
    const sound = soundMap.getBreakSound(blockName)
    await playHardcodedSound(sound, position, 0.6, 1)
  }

  const registerEvents = () => {
    bot.on('move', () => {
      void movementHappening()
    })
    bot._client.on('world_event', async ({ effectId, location, data, global: disablePosVolume }) => {
      const position = disablePosVolume ? undefined : new Vec3(location.x, location.y, location.z)
      if (effectId === 2001) {
        // break event
        const block = loadedData.blocksByStateId[data]
        await playBlockBreak(block.name, position)
      }
      // these produce glass break sound
      if (effectId === 2002 || effectId === 2003 || effectId === 2007) {
        await playHardcodedSound('block.glass.break', position, 1, 1)
      }
      if (effectId === 1004) {
        // firework shoot
        await playHardcodedSound('entity.firework_rocket.launch', position, 1, 1)
      }
      if (effectId === 1006 || effectId === 1007 || effectId === 1014) {
        // wooden door open/close
        await playHardcodedSound('block.wooden_door.open', position, 1, 1)
      }
      if (effectId === 1002) {
        // dispenser shoot
        await playHardcodedSound('block.dispenser.dispense', position, 1, 1)
      }
      if (effectId === 1024) {
        // wither shoot
        await playHardcodedSound('entity.wither.shoot', position, 1, 1)
      }
      if (effectId === 1031) {
        // anvil land
        await playHardcodedSound('block.anvil.land', position, 1, 1)
      }
      if (effectId === 1010) {
        console.log('play record', data)
      }
    })

    let diggingBlock: Block | null = null
    customEvents.on('digStart', () => {
      diggingBlock = bot.blockAtCursor(5)
    })
    bot.on('diggingCompleted', async () => {
      if (diggingBlock) {
        await playBlockBreak(diggingBlock.name, diggingBlock.position)
      }
    })
  }

  registerEvents()
})

subscribeKey(resourcePackState, 'resourcePackInstalled', async () => {
  await updateResourcePack()
})

export const downloadSoundsIfNeeded = async () => {
  if (!window.allSoundsMap) {
    try {
      await loadScript('./sounds.js')
    } catch (err) {
      console.warn('Sounds map was not generated. Sounds will not be played.')
    }
  }
}

export const lastPlayedSounds = {
  lastClientPlayed: [] as string[],
  lastServerPlayed: {} as Record<string, { count: number, last: number }>,
}

const getDistance = (pos1: Vec3, pos2: Vec3) => {
  return Math.hypot((pos1.x - pos2.x), (pos1.y - pos2.y), (pos1.z - pos2.z))
}
