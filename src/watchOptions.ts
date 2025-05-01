// not all options are watched here

import { subscribeKey } from 'valtio/utils'
import { isMobile } from 'renderer/viewer/lib/simpleUtils'
import { WorldDataEmitter } from 'renderer/viewer/lib/worldDataEmitter'
import { options, watchValue } from './optionsStorage'
import { reloadChunks } from './utils'
import { miscUiState } from './globalState'
import { isCypress } from './standaloneUtils'

subscribeKey(options, 'renderDistance', reloadChunks)
subscribeKey(options, 'multiplayerRenderDistance', reloadChunks)

watchValue(options, o => {
  document.documentElement.style.setProperty('--chatScale', `${o.chatScale / 100}`)
  document.documentElement.style.setProperty('--chatWidth', `${o.chatWidth}px`)
  document.documentElement.style.setProperty('--chatHeight', `${o.chatHeight}px`)
  // gui scale is set in scaleInterface.ts
})
const updateTouch = (o) => {
  miscUiState.currentTouch = o.alwaysShowMobileControls || isMobile()
}
watchValue(options, updateTouch)
window.matchMedia('(pointer: coarse)').addEventListener('change', (e) => {
  updateTouch(options)
})

/** happens once */
export const watchOptionsAfterViewerInit = () => {
  watchValue(options, o => {
    appViewer.inWorldRenderingConfig.showChunkBorders = o.showChunkBorders
  })

  watchValue(options, o => {
    appViewer.inWorldRenderingConfig.mesherWorkers = o.lowMemoryMode ? 1 : o.numWorkers
  })

  watchValue(options, o => {
    appViewer.inWorldRenderingConfig.renderEntities = o.renderEntities
  })

  watchValue(options, o => {
    const { renderDebug } = o
    if (renderDebug === 'none' || isCypress()) {
      appViewer.config.statsVisible = 0
    } else if (o.renderDebug === 'basic') {
      appViewer.config.statsVisible = 1
    } else if (o.renderDebug === 'advanced') {
      appViewer.config.statsVisible = 2
    }
  })

  // Track window focus state and update FPS limit accordingly
  let windowFocused = true
  const updateFpsLimit = (o: typeof options) => {
    const backgroundFpsLimit = o.backgroundRendering
    const normalFpsLimit = o.frameLimit

    if (windowFocused) {
      appViewer.config.fpsLimit = normalFpsLimit || undefined
    } else if (backgroundFpsLimit === '5fps') {
      appViewer.config.fpsLimit = 5
    } else if (backgroundFpsLimit === '20fps') {
      appViewer.config.fpsLimit = 20
    } else {
      appViewer.config.fpsLimit = undefined
    }
  }

  window.addEventListener('focus', () => {
    windowFocused = true
    updateFpsLimit(options)
  })
  window.addEventListener('blur', () => {
    windowFocused = false
    updateFpsLimit(options)
  })

  watchValue(options, o => {
    updateFpsLimit(o)
  })

  watchValue(options, (o, isChanged) => {
    appViewer.inWorldRenderingConfig.clipWorldBelowY = o.clipWorldBelowY
    appViewer.inWorldRenderingConfig.extraBlockRenderers = !o.disableSignsMapsSupport
    appViewer.inWorldRenderingConfig.fetchPlayerSkins = o.loadPlayerSkins
    appViewer.inWorldRenderingConfig.highlightBlockColor = o.highlightBlockColor
    appViewer.inWorldRenderingConfig._experimentalSmoothChunkLoading = o.rendererSharedOptions._experimentalSmoothChunkLoading
    appViewer.inWorldRenderingConfig._renderByChunks = o.rendererSharedOptions._renderByChunks
  })

  appViewer.inWorldRenderingConfig.smoothLighting = options.smoothLighting
  subscribeKey(options, 'smoothLighting', () => {
    appViewer.inWorldRenderingConfig.smoothLighting = options.smoothLighting
  })

  const updateLightingStrategy = () => {
    if (!bot) return
    if (!options.experimentalLightingV1) {
      appViewer.inWorldRenderingConfig.clientSideLighting = 'none'
      appViewer.inWorldRenderingConfig.enableLighting = false
      appViewer.inWorldRenderingConfig.legacyLighting = true
      return
    }

    const lightingEnabled = options.dayCycle
    if (!lightingEnabled) {
      appViewer.inWorldRenderingConfig.clientSideLighting = 'none'
      appViewer.inWorldRenderingConfig.enableLighting = false
      return
    }

    appViewer.inWorldRenderingConfig.legacyLighting = false

    // for now ignore saved lighting to allow proper updates and singleplayer created worlds
    // appViewer.inWorldRenderingConfig.flyingSquidWorkarounds = miscUiState.flyingSquid
    const serverParsingSupported = miscUiState.flyingSquid ? /* !bot.supportFeature('blockStateId') */false : bot.supportFeature('blockStateId')

    const serverLightingPossible = serverParsingSupported && (options.lightingStrategy === 'prefer-server' || options.lightingStrategy === 'always-server')
    const clientLightingPossible = options.lightingStrategy !== 'always-server'

    const clientSideLighting = !serverLightingPossible
    appViewer.inWorldRenderingConfig.clientSideLighting = serverLightingPossible && clientLightingPossible ? 'partial' : clientSideLighting ? 'full' : 'none'
    appViewer.inWorldRenderingConfig.enableLighting = serverLightingPossible || clientLightingPossible
  }

  subscribeKey(options, 'lightingStrategy', updateLightingStrategy)

  customEvents.on('mineflayerBotCreated', () => {
    updateLightingStrategy()
  })

  watchValue(options, o => {
    appViewer.inWorldRenderingConfig.starfield = o.starfieldRendering
  })

  watchValue(options, o => {
    // appViewer.inWorldRenderingConfig.neighborChunkUpdates = o.neighborChunkUpdates
  })
}

export const watchOptionsAfterWorldViewInit = (worldView: WorldDataEmitter) => {
  watchValue(options, o => {
    if (!worldView) return
    worldView.keepChunksDistance = o.keepChunksDistance
    appViewer.inWorldRenderingConfig.renderEars = o.renderEars
    appViewer.inWorldRenderingConfig.showHand = o.showHand
    appViewer.inWorldRenderingConfig.viewBobbing = o.viewBobbing
  })
}
