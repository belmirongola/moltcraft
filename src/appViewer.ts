import { EventEmitter } from 'events'
import { WorldDataEmitter } from 'renderer/viewer/lib/worldDataEmitter'
import { BasePlayerState, IPlayerState } from 'renderer/viewer/lib/basePlayerState'
import { subscribeKey } from 'valtio/utils'
import { defaultWorldRendererConfig, WorldRendererConfig } from 'renderer/viewer/lib/worldrendererCommon'
import { Vec3 } from 'vec3'
import { getSyncWorld } from 'renderer/playground/shared'
import { SoundSystem } from 'renderer/viewer/lib/threeJsSound'
import { playerState, PlayerStateManager } from './mineflayer/playerState'
import { createNotificationProgressReporter, createNullProgressReporter, ProgressReporter } from './core/progressReporter'
import { setLoadingScreenStatus } from './appStatus'
import { activeModalStack, miscUiState } from './globalState'
import { options } from './optionsStorage'
import { loadMinecraftData } from './connect'
import { ResourcesManager } from './resourcesManager'

export interface WorldReactiveState {
  chunksLoaded: number
  chunksTotal: number
  allChunksLoaded: boolean
}

export interface GraphicsBackendConfig {
  fpsLimit?: number
  powerPreference?: 'high-performance' | 'low-power'
  statsVisible?: number
}

const defaultGraphicsBackendConfig: GraphicsBackendConfig = {
  fpsLimit: undefined,
  powerPreference: undefined
}

export interface GraphicsInitOptions {
  resourcesManager: ResourcesManager
  config: GraphicsBackendConfig

  displayCriticalError: (error: Error) => void
}

export interface DisplayWorldOptions {
  worldView: WorldDataEmitter
  inWorldRenderingConfig: WorldRendererConfig
  playerState: IPlayerState
}

export type GraphicsBackendLoader = (options: GraphicsInitOptions) => GraphicsBackend

export interface GraphicsBackend {
  NAME: string
  startPanorama: () => void
  prepareResources: (version: string, progressReporter: ProgressReporter) => Promise<void>
  startWorld: (options: DisplayWorldOptions) => void
  disconnect: () => void
  setRendering: (rendering: boolean) => void
  getRenderer: () => string
  getDebugOverlay: () => Record<string, any>
  updateCamera: (pos: Vec3 | null, yaw: number, pitch: number) => void
  setRoll: (roll: number) => void
  worldState: WorldReactiveState
  soundSystem: SoundSystem | undefined
}

export class AppViewer {
  resourcesManager = new ResourcesManager()
  worldView: WorldDataEmitter
  readonly config: GraphicsBackendConfig = {
    ...defaultGraphicsBackendConfig,
    powerPreference: options.gpuPreference === 'default' ? undefined : options.gpuPreference
  }
  backend?: GraphicsBackend
  backendLoader?: GraphicsBackendLoader
  private queuedDisplay?: {
    method: string
    args: any[]
  }
  currentDisplay = null as 'menu' | 'world' | null
  inWorldRenderingConfig: WorldRendererConfig = defaultWorldRendererConfig
  lastCamUpdate = 0
  playerState = playerState

  loadBackend (loader: GraphicsBackendLoader) {
    if (this.backend) {
      this.disconnectBackend()
    }

    this.backendLoader = loader
    const loaderOptions: GraphicsInitOptions = {
      resourcesManager: this.resourcesManager,
      config: this.config,
      displayCriticalError (error) {
        console.error(error)
        setLoadingScreenStatus(error.message, true)
      },
    }
    this.backend = loader(loaderOptions)

    if (this.resourcesManager.currentResources) {
      void this.prepareResources(this.resourcesManager.currentResources.version, createNotificationProgressReporter())
    }

    // Execute queued action if exists
    if (this.queuedDisplay) {
      const { method, args } = this.queuedDisplay
      this.backend[method](...args)
    }
  }

  resetBackend () {
    if (this.backendLoader) {
      this.loadBackend(this.backendLoader)
    }
  }

  startPanorama () {
    if (this.currentDisplay === 'menu') return
    this.currentDisplay = 'menu'
    if (options.disableAssets) return
    if (this.backend) {
      this.backend.startPanorama()
    }
    this.queuedDisplay = { method: 'startPanorama', args: [] }
  }

  async prepareResources (version: string, progressReporter: ProgressReporter) {
    if (this.backend) {
      await this.backend.prepareResources(version, progressReporter)
    }
  }

  startWorld (world, renderDistance: number, startPosition: Vec3, playerStateSend: IPlayerState = playerState) {
    if (this.currentDisplay === 'world') throw new Error('World already started')
    this.currentDisplay = 'world'
    this.worldView = new WorldDataEmitter(world, renderDistance, startPosition)
    window.worldView = this.worldView

    const displayWorldOptions: DisplayWorldOptions = {
      worldView: this.worldView,
      inWorldRenderingConfig: this.inWorldRenderingConfig,
      playerState: playerStateSend
    }
    if (this.backend) {
      this.backend.startWorld(displayWorldOptions)
    }
    this.queuedDisplay = { method: 'startWorld', args: [displayWorldOptions] }
  }

  destroyAll () {
    this.disconnectBackend()
    this.resourcesManager.destroy()
  }

  disconnectBackend () {
    if (this.backend) {
      this.backend.disconnect()
      this.backend = undefined
    }
    this.currentDisplay = null
    // this.queuedDisplay = undefined
  }

  get utils () {
    return {
      async waitingForChunks () {
        if (this.backend?.worldState.allChunksLoaded) return
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            if (this.backend?.worldState.allChunksLoaded) {
              clearInterval(interval)
              resolve(true)
            }
          }, 100)
        })
      }
    }
  }
}

export const appViewer = new AppViewer()
window.appViewer = appViewer

const initialMenuStart = async () => {
  if (appViewer.currentDisplay === 'world') {
    appViewer.resetBackend()
  }
  appViewer.startPanorama()

  // await appViewer.resourcesManager.loadMcData('1.21.4')
  // const world = getSyncWorld('1.21.4')
  // await appViewer.prepareResources('1.21.4', createNullProgressReporter())
  // world.setBlockStateId(new Vec3(0, 64, 0), 1)
  // appViewer.startWorld(world, 3, new Vec3(0, 64, 0), new BasePlayerState())
  // appViewer.backend?.updateCamera(new Vec3(0, 64, 2), 0, 0)
  // void appViewer.worldView.init(new Vec3(0, 64, 0))
}
window.initialMenuStart = initialMenuStart

const modalStackUpdateChecks = () => {
  // maybe start panorama
  if (activeModalStack.length === 0 && !miscUiState.gameLoaded) {
    void initialMenuStart()
  }

  if (appViewer.backend) {
    const hasAppStatus = activeModalStack.some(m => m.reactType === 'app-status')
    appViewer.backend.setRendering(!hasAppStatus)
  }
}
subscribeKey(activeModalStack, 'length', modalStackUpdateChecks)
modalStackUpdateChecks()
