import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { proxy } from 'valtio'
import { GraphicsBackendLoader, GraphicsBackend, GraphicsInitOptions, DisplayWorldOptions, RendererReactiveState } from '../../../src/appViewer'
import { ProgressReporter } from '../../../src/core/progressReporter'
import { WorldRendererThree } from '../lib/worldrendererThree'
import { DocumentRenderer } from './documentRenderer'
import { PanoramaRenderer } from './panorama'

// https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
THREE.ColorManagement.enabled = false

const getBackendMethods = (worldRenderer: WorldRendererThree) => {
  return {
    updateMap: worldRenderer.entities.updateMap.bind(worldRenderer.entities),
    updateCustomBlock: worldRenderer.updateCustomBlock.bind(worldRenderer),
    getBlockInfo: worldRenderer.getBlockInfo.bind(worldRenderer),
  }
}

export type ThreeJsBackendMethods = ReturnType<typeof getBackendMethods>

const createGraphicsBackend: GraphicsBackendLoader = (initOptions: GraphicsInitOptions) => {
  // Private state
  const documentRenderer = new DocumentRenderer(initOptions)
  globalThis.renderer = documentRenderer.renderer

  let panoramaRenderer: PanoramaRenderer | null = null
  let worldRenderer: WorldRendererThree | null = null

  const reactiveState: RendererReactiveState = proxy({
    world: {
      chunksLoaded: 0,
      chunksTotal: 0,
      allChunksLoaded: false,
    },
    renderer: WorldRendererThree.getRendererInfo(documentRenderer.renderer) ?? '...',
    preventEscapeMenu: false
  })

  const startPanorama = () => {
    if (worldRenderer) return
    if (!panoramaRenderer) {
      panoramaRenderer = new PanoramaRenderer(documentRenderer, initOptions, !!process.env.SINGLE_FILE_BUILD_MODE)
      void panoramaRenderer.start()
      window.panoramaRenderer = panoramaRenderer
    }
  }

  let version = ''
  const prepareResources = async (ver: string, progressReporter: ProgressReporter): Promise<void> => {
    version = ver
  }

  const startWorld = (displayOptions: DisplayWorldOptions) => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    worldRenderer = new WorldRendererThree(documentRenderer.renderer, initOptions, displayOptions, version, reactiveState)
    documentRenderer.render = (sizeChanged: boolean) => {
      worldRenderer?.render(sizeChanged)
    }
    window.viewer ??= {}
    window.world = worldRenderer
    window.viewer.world = worldRenderer
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
    //@ts-expect-error mark as three.js renderer
    __isThreeJsRenderer: true,
    NAME: `three.js ${THREE.REVISION}`,
    startPanorama,
    prepareResources,
    startWorld,
    disconnect,
    setRendering (rendering) {
      documentRenderer.setPaused(!rendering)
    },
    getDebugOverlay: () => ({
    }),
    updateCamera (pos: Vec3 | null, yaw: number, pitch: number) {
      worldRenderer?.setFirstPersonCamera(pos, yaw, pitch)
    },
    setRoll (roll: number) {
      worldRenderer?.setCameraRoll(roll)
    },
    reactiveState,
    get soundSystem () {
      return worldRenderer?.soundSystem
    },
    get backendMethods () {
      if (!worldRenderer) return undefined
      return getBackendMethods(worldRenderer)
    }
  }

  return backend
}

export default createGraphicsBackend
