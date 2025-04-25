import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { GraphicsBackendLoader, GraphicsBackend, GraphicsInitOptions, DisplayWorldOptions } from '../../../src/appViewer'
import { ProgressReporter } from '../../../src/core/progressReporter'
import { showNotification } from '../../../src/react/NotificationProvider'
import { WorldRendererThree } from './worldrendererThree'
import { DocumentRenderer } from './documentRenderer'
import { PanoramaRenderer } from './panorama'

// https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
THREE.ColorManagement.enabled = false
window.THREE = THREE

const getBackendMethods = (worldRenderer: WorldRendererThree) => {
  return {
    updateMap: worldRenderer.entities.updateMap.bind(worldRenderer.entities),
    updateCustomBlock: worldRenderer.updateCustomBlock.bind(worldRenderer),
    getBlockInfo: worldRenderer.getBlockInfo.bind(worldRenderer),
    playEntityAnimation: worldRenderer.entities.playAnimation.bind(worldRenderer.entities),
    damageEntity: worldRenderer.entities.handleDamageEvent.bind(worldRenderer.entities),
    updatePlayerSkin: worldRenderer.entities.updatePlayerSkin.bind(worldRenderer.entities),
    changeHandSwingingState: worldRenderer.changeHandSwingingState.bind(worldRenderer),
    getHighestBlocks: worldRenderer.getHighestBlocks.bind(worldRenderer),
    rerenderAllChunks: worldRenderer.rerenderAllChunks.bind(worldRenderer),

    addMedia: worldRenderer.media.addMedia.bind(worldRenderer.media),
    destroyMedia: worldRenderer.media.destroyMedia.bind(worldRenderer.media),
    setVideoPlaying: worldRenderer.media.setVideoPlaying.bind(worldRenderer.media),
    setVideoSeeking: worldRenderer.media.setVideoSeeking.bind(worldRenderer.media),
    setVideoVolume: worldRenderer.media.setVideoVolume.bind(worldRenderer.media),
    setVideoSpeed: worldRenderer.media.setVideoSpeed.bind(worldRenderer.media),

    addSectionAnimation (id: string, animation: typeof worldRenderer.sectionsOffsetsAnimations[string]) {
      worldRenderer.sectionsOffsetsAnimations[id] = animation
    },
    removeSectionAnimation (id: string) {
      delete worldRenderer.sectionsOffsetsAnimations[id]
    },

    shakeFromDamage: worldRenderer.cameraShake.shakeFromDamage.bind(worldRenderer.cameraShake),
    onPageInteraction: worldRenderer.media.onPageInteraction.bind(worldRenderer.media),
    downloadMesherLog: worldRenderer.downloadMesherLog.bind(worldRenderer),
  }
}

export type ThreeJsBackendMethods = ReturnType<typeof getBackendMethods>

const createGraphicsBackend: GraphicsBackendLoader = (initOptions: GraphicsInitOptions) => {
  // Private state
  const documentRenderer = new DocumentRenderer(initOptions)
  globalThis.renderer = documentRenderer.renderer

  let panoramaRenderer: PanoramaRenderer | null = null
  let worldRenderer: WorldRendererThree | null = null

  const startPanorama = async () => {
    if (worldRenderer) return
    if (!panoramaRenderer) {
      panoramaRenderer = new PanoramaRenderer(documentRenderer, initOptions, !!process.env.SINGLE_FILE_BUILD_MODE)
      window.panoramaRenderer = panoramaRenderer
      callModsMethod('panoramaCreated', panoramaRenderer)
      await panoramaRenderer.start()
      callModsMethod('panoramaReady', panoramaRenderer)
    }
  }

  let version = ''
  const prepareResources = async (ver: string, progressReporter: ProgressReporter): Promise<void> => {
    version = ver
    await initOptions.resourcesManager.updateAssetsData({ })
  }

  const startWorld = async (displayOptions: DisplayWorldOptions) => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    worldRenderer = new WorldRendererThree(documentRenderer.renderer, initOptions, displayOptions)
    await worldRenderer.worldReadyPromise
    documentRenderer.render = (sizeChanged: boolean) => {
      worldRenderer?.render(sizeChanged)
    }
    window.world = worldRenderer
    callModsMethod('worldReady', worldRenderer)
  }

  const disconnect = () => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    if (documentRenderer) {
      documentRenderer.dispose()
    }
    if (worldRenderer) {
      worldRenderer.destroy()
      worldRenderer = null
    }
  }

  // Public interface
  const backend: GraphicsBackend = {
    id: 'threejs',
    displayName: `three.js ${THREE.REVISION}`,
    startPanorama,
    startWorld,
    disconnect,
    setRendering (rendering) {
      documentRenderer.setPaused(!rendering)
      if (worldRenderer) worldRenderer.renderingActive = rendering
    },
    getDebugOverlay: () => ({
    }),
    updateCamera (pos: Vec3 | null, yaw: number, pitch: number) {
      worldRenderer?.setFirstPersonCamera(pos, yaw, pitch)
    },
    get soundSystem () {
      return worldRenderer?.soundSystem
    },
    get backendMethods () {
      if (!worldRenderer) return undefined
      return getBackendMethods(worldRenderer)
    }
  }

  globalThis.threeJsBackend = backend
  globalThis.resourcesManager = initOptions.resourcesManager
  callModsMethod('default', backend)

  return backend
}

const callModsMethod = (method: string, ...args: any[]) => {
  for (const mod of Object.values((window.loadedMods ?? {}) as Record<string, any>)) {
    try {
      mod.threeJsBackendModule?.[method]?.(...args)
    } catch (err) {
      const errorMessage = `[mod three.js] Error calling ${method} on ${mod.name}: ${err}`
      showNotification(errorMessage, 'error')
      throw new Error(errorMessage)
    }
  }
}

createGraphicsBackend.id = 'threejs'
export default createGraphicsBackend
