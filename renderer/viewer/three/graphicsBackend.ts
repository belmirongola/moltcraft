import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { proxy } from 'valtio'
import { GraphicsBackendLoader, GraphicsBackend, GraphicsBackendOptions, DisplayWorldOptions } from '../../../src/appViewer'
import { ProgressReporter } from '../../../src/core/progressReporter'
import { ThreeJsWorldRenderer } from '../lib/viewer'
import { WorldRendererThree } from '../lib/worldrendererThree'
import { DocumentRenderer } from './renderer'
import { PanoramaRenderer } from './panorama'

// https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
THREE.ColorManagement.enabled = false

const createGraphicsBackend: GraphicsBackendLoader = (options: GraphicsBackendOptions) => {
  // Private state
  const documentRenderer = new DocumentRenderer(options)
  globalThis.renderer = documentRenderer.renderer

  let panoramaRenderer: PanoramaRenderer | null = null
  let worldRenderer: ThreeJsWorldRenderer | null = null

  const worldState = proxy({
    chunksLoaded: 0,
    chunksTotal: 0
  })

  const startPanorama = () => {
    if (worldRenderer) return
    if (!panoramaRenderer) {
      panoramaRenderer = new PanoramaRenderer(documentRenderer)
      void panoramaRenderer.start()
    }
  }

  let version = ''
  const updateResources = async (ver: string, progressReporter: ProgressReporter): Promise<void> => {
    version = ver
  }

  const startWorld = (options: DisplayWorldOptions) => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    worldRenderer = new ThreeJsWorldRenderer(documentRenderer.renderer, options)
    void worldRenderer.setVersion(version)
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
      worldRenderer.dispose()
      worldRenderer = null
    }
  }

  const renderer = WorldRendererThree.getRendererInfo(documentRenderer.renderer) ?? '...'
  // viewer.setFirstPersonCamera(null, bot.entity.yaw, bot.entity.pitch)

  // Public interface
  const backend: GraphicsBackend = {
    NAME: `three.js ${THREE.REVISION}`,
    startPanorama,
    updateResources,
    startWorld,
    disconnect,
    setRendering (rendering) {
      documentRenderer.setPaused(!rendering)
    },
    getRenderer: () => renderer,
    getDebugOverlay: () => ({
    }),
    updateCamera (pos: Vec3 | null, yaw: number, pitch: number) {
      worldRenderer?.setFirstPersonCamera(pos, yaw, pitch)
    },
    setRoll (roll: number) {
      worldRenderer?.setCameraRoll(roll)
    },
    worldState
  }

  return backend
}

export default createGraphicsBackend
