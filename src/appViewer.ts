import { WorldDataEmitter } from 'renderer/viewer/lib/worldDataEmitter'
import { IPlayerState } from 'renderer/viewer/lib/basePlayerState'
import { subscribeKey } from 'valtio/utils'
import { defaultWorldRendererConfig, WorldRendererConfig } from 'renderer/viewer/lib/worldrendererCommon'
import { Vec3 } from 'vec3'
import { SoundSystem } from 'renderer/viewer/three/threeJsSound'
import { proxy } from 'valtio'
import { getDefaultRendererState } from 'renderer/viewer/baseGraphicsBackend'
import { playerState } from './mineflayer/playerState'
import { createNotificationProgressReporter, ProgressReporter } from './core/progressReporter'
import { setLoadingScreenStatus } from './appStatus'
import { activeModalStack, miscUiState } from './globalState'
import { options } from './optionsStorage'
import { ResourcesManager } from './resourcesManager'
import { watchOptionsAfterWorldViewInit } from './watchOptions'

export interface RendererReactiveState {
  world: {
    chunksLoaded: string[]
    chunksTotalNumber: number
    allChunksLoaded: boolean
    mesherWork: boolean
    intersectMedia: { id: string, x: number, y: number } | null
  }
  renderer: string
  preventEscapeMenu: boolean
}

export interface GraphicsBackendConfig {
  fpsLimit?: number
  powerPreference?: 'high-performance' | 'low-power'
  statsVisible?: number
  sceneBackground: string
}

const defaultGraphicsBackendConfig: GraphicsBackendConfig = {
  fpsLimit: undefined,
  powerPreference: undefined,
  sceneBackground: 'lightblue'
}

export interface GraphicsInitOptions {
  resourcesManager: ResourcesManager
  config: GraphicsBackendConfig

  displayCriticalError: (error: Error) => void
}

export interface DisplayWorldOptions {
  version: string
  worldView: WorldDataEmitter
  inWorldRenderingConfig: WorldRendererConfig
  playerState: IPlayerState
  rendererState: RendererReactiveState
}

export type GraphicsBackendLoader = (options: GraphicsInitOptions) => GraphicsBackend

// no sync methods
export interface GraphicsBackend {
  id: string
  displayName?: string
  startPanorama: () => void
  // prepareResources: (version: string, progressReporter: ProgressReporter) => Promise<void>
  startWorld: (options: DisplayWorldOptions) => void
  disconnect: () => void
  setRendering: (rendering: boolean) => void
  getDebugOverlay?: () => Record<string, any>
  updateCamera: (pos: Vec3 | null, yaw: number, pitch: number) => void
  setRoll?: (roll: number) => void
  soundSystem: SoundSystem | undefined

  backendMethods: Record<string, unknown> | undefined
}

export class AppViewer {
  resourcesManager = new ResourcesManager()
  worldView: WorldDataEmitter | undefined
  readonly config: GraphicsBackendConfig = {
    ...defaultGraphicsBackendConfig,
    powerPreference: options.gpuPreference === 'default' ? undefined : options.gpuPreference
  }
  backend?: GraphicsBackend
  backendLoader?: GraphicsBackendLoader
  private currentState?: {
    method: string
    args: any[]
  }
  currentDisplay = null as 'menu' | 'world' | null
  inWorldRenderingConfig: WorldRendererConfig = proxy(defaultWorldRendererConfig)
  lastCamUpdate = 0
  playerState = playerState
  rendererState = proxy(getDefaultRendererState())
  worldReady: Promise<void>
  private resolveWorldReady: () => void

  constructor () {
    this.disconnectBackend()
  }

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

    // if (this.resourcesManager.currentResources) {
    //   void this.prepareResources(this.resourcesManager.currentResources.version, createNotificationProgressReporter())
    // }

    // Execute queued action if exists
    if (this.currentState) {
      const { method, args } = this.currentState
      this.backend[method](...args)
      if (method === 'startWorld') {
        void this.worldView!.init(args[0].playerState.getPosition())
      }
    }
  }

  startWorld (world, renderDistance: number, playerStateSend: IPlayerState = playerState) {
    if (this.currentDisplay === 'world') throw new Error('World already started')
    this.currentDisplay = 'world'
    const startPosition = playerStateSend.getPosition()
    this.worldView = new WorldDataEmitter(world, renderDistance, startPosition)
    window.worldView = this.worldView
    watchOptionsAfterWorldViewInit(this.worldView)

    const displayWorldOptions: DisplayWorldOptions = {
      version: this.resourcesManager.currentConfig!.version,
      worldView: this.worldView,
      inWorldRenderingConfig: this.inWorldRenderingConfig,
      playerState: playerStateSend,
      rendererState: this.rendererState
    }
    if (this.backend) {
      this.backend.startWorld(displayWorldOptions)
      void this.worldView.init(startPosition)
    }
    this.currentState = { method: 'startWorld', args: [displayWorldOptions] }

    // Resolve the promise after world is started
    this.resolveWorldReady()
  }

  resetBackend (cleanState = false) {
    if (cleanState) {
      this.currentState = undefined
      this.currentDisplay = null
      this.worldView = undefined
    }
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
    this.currentState = { method: 'startPanorama', args: [] }
  }

  // async prepareResources (version: string, progressReporter: ProgressReporter) {
  //   if (this.backend) {
  //     await this.backend.prepareResources(version, progressReporter)
  //   }
  // }

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
    const { promise, resolve } = Promise.withResolvers<void>()
    this.worldReady = promise
    this.resolveWorldReady = resolve
    Object.assign(this.rendererState, getDefaultRendererState())
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
    appViewer.resetBackend(true)
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

  appViewer.inWorldRenderingConfig.foreground = activeModalStack.length === 0
}
subscribeKey(activeModalStack, 'length', modalStackUpdateChecks)
modalStackUpdateChecks()
