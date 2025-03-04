import * as THREE from 'three'
import { GraphicsBackendLoader, GraphicsBackend, GraphicsBackendOptions, DisplayWorldOptions } from '../../../src/appViewer'
import { ProgressReporter } from '../../../src/core/progressReporter'
import { WorldRendererThree } from '../lib/worldrendererThree'
import { DocumentRenderer } from './renderer'
import { PanoramaRenderer } from './panorama'

const createGraphicsBackend: GraphicsBackendLoader = (options: GraphicsBackendOptions) => {
  // Private state
  const documentRenderer = new DocumentRenderer(options)
  globalThis.renderer = documentRenderer.renderer
  let panoramaRenderer: PanoramaRenderer | null = null

  // Private methods
  const startPanorama = () => {
    if (!panoramaRenderer) {
      panoramaRenderer = new PanoramaRenderer(documentRenderer)
      void panoramaRenderer.start()
    }
  }

  const updateResources = async (version: string, progressReporter: ProgressReporter): Promise<void> => {
    // Implementation for updating resources will be added here
  }

  const startWorld = (options: DisplayWorldOptions) => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
  }

  const disconnect = () => {
    if (panoramaRenderer) {
      panoramaRenderer.dispose()
      panoramaRenderer = null
    }
    if (documentRenderer) {
      documentRenderer.dispose()
    }
  }

  const startRender = () => {
    documentRenderer.setPaused(false)
  }

  const stopRender = () => {
    documentRenderer.setPaused(true)
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
    startRender,
    stopRender,
    getRenderer: () => renderer,
    getDebugOverlay: () => ({
    })
  }

  return backend
}

export default createGraphicsBackend
