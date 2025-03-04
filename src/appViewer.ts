import { WorldDataEmitter } from 'renderer/viewer/lib/worldDataEmitter'
import { IPlayerState } from 'renderer/viewer/lib/basePlayerState'
import { subscribeKey } from 'valtio/utils'
import { defaultWorldRendererConfig, WorldRendererConfig } from 'renderer/viewer/lib/worldrendererCommon'
import { Vec3 } from 'vec3'
import { playerState, PlayerStateManager } from './mineflayer/playerState'
import { createNotificationProgressReporter, ProgressReporter } from './core/progressReporter'
import { setLoadingScreenStatus } from './appStatus'
import { activeModalStack, miscUiState } from './globalState'
import { options } from './optionsStorage'

export interface GraphicsBackendConfig {
  fpsLimit?: number
  powerPreference?: 'high-performance' | 'low-power'
  statsVisible?: number
}

const defaultGraphicsBackendConfig: GraphicsBackendConfig = {
  fpsLimit: undefined,
  powerPreference: undefined
}

export interface GraphicsBackendOptions {
  resourcesManager: ResourcesManager
  config: GraphicsBackendConfig
  displayCriticalError: (error: Error) => void
}

export interface DisplayWorldOptions {
  resourcesManager: ResourcesManager
  worldView: WorldDataEmitter
  inWorldRenderingConfig: WorldRendererConfig
  playerState: IPlayerState
}

export type GraphicsBackendLoader = (options: GraphicsBackendOptions) => GraphicsBackend

export interface GraphicsBackend {
  NAME: string
  startPanorama: () => void
  updateResources: (version: string, progressReporter: ProgressReporter) => Promise<void>
  startWorld: (options: DisplayWorldOptions) => void
  disconnect: () => void

  setRendering: (rendering: boolean) => void

  getRenderer: () => string
  getDebugOverlay: () => {
    entitiesString?: string
    right?: Record<string, string>
    left?: Record<string, string>
  }
  updateCamera: (pos: Vec3 | null, yaw: number, pitch: number) => void
  setRoll: (roll: number) => void
}

export class AppViewer {
  resourcesManager: ResourcesManager
  worldView: WorldDataEmitter
  // playerState: IPlayerState
  readonly config: GraphicsBackendConfig = {
    ...defaultGraphicsBackendConfig,
    powerPreference: options.gpuPreference === 'default' ? undefined : options.gpuPreference
  }
  backend?: GraphicsBackend
  private queuedDisplay?: {
    method: string
    args: any[]
  }
  inWorldRenderingConfig: WorldRendererConfig = defaultWorldRendererConfig
  lastCamUpdate = 0

  loadBackend (loader: GraphicsBackendLoader, loadResourcesVersion?: string) {
    if (this.backend) {
      this.backend.disconnect()
    }

    this.backend = loader({
      resourcesManager: this.resourcesManager,
      config: this.config,
      displayCriticalError (error) {
        console.error(error)
        setLoadingScreenStatus(error.message, true)
      },
    })

    if (loadResourcesVersion) {
      void this.updateResources(loadResourcesVersion, createNotificationProgressReporter())
    }

    // Execute queued action if exists
    if (this.queuedDisplay) {
      const { method, args } = this.queuedDisplay
      this.backend[method](...args)
    }
  }

  startPanorama () {
    if (options.disableAssets) return
    if (this.backend) {
      this.backend.startPanorama()
    }
    this.queuedDisplay = { method: 'startPanorama', args: [] }
  }

  async updateResources (version: string, progressReporter: ProgressReporter) {
    if (this.backend) {
      await this.backend.updateResources(version, progressReporter)
    }
  }

  startWorld (world, renderDistance, startPosition) {
    this.worldView = new WorldDataEmitter(world, renderDistance, startPosition)
    window.worldView = this.worldView
    // this.playerState = new PlayerStateManager()
    if (this.backend) {
      this.backend.startWorld({
        resourcesManager: this.resourcesManager,
        worldView: this.worldView,
        inWorldRenderingConfig: this.inWorldRenderingConfig,
        playerState
      })
    }
    this.queuedDisplay = { method: 'startWorld', args: [options] }
  }

  disconnect () {
    if (this.backend) {
      this.backend.disconnect()
      this.backend = undefined
    }
    this.queuedDisplay = undefined
  }
}

export const appViewer = new AppViewer()
window.appViewer = appViewer

class ResourcesManager {
}

const modalStackUpdate = () => {
  if (activeModalStack.length === 0 && !miscUiState.gameLoaded) {
    // tood reset backend
    appViewer.startPanorama()
  }

  if (appViewer.backend) {
    const hasAppStatus = activeModalStack.some(m => m.reactType === 'app-status')
    appViewer.backend.setRendering(!hasAppStatus)
  }
}
subscribeKey(activeModalStack, 'length', modalStackUpdate)
modalStackUpdate()
