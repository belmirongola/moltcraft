import { EventEmitter } from 'events'
import { WorldDataEmitter } from 'renderer/viewer/lib/worldDataEmitter'
import { IPlayerState } from 'renderer/viewer/lib/basePlayerState'
import { subscribeKey } from 'valtio/utils'
import { defaultWorldRendererConfig, WorldRendererConfig } from 'renderer/viewer/lib/worldrendererCommon'
import { Vec3 } from 'vec3'
import { proxy } from 'valtio'
import blocksAtlases from 'mc-assets/dist/blocksAtlases.json'
import itemsAtlases from 'mc-assets/dist/itemsAtlases.json'
import itemDefinitionsJson from 'mc-assets/dist/itemDefinitions.json'
import blocksAtlasLatest from 'mc-assets/dist/blocksAtlasLatest.png'
import blocksAtlasLegacy from 'mc-assets/dist/blocksAtlasLegacy.png'
import itemsAtlasLatest from 'mc-assets/dist/itemsAtlasLatest.png'
import itemsAtlasLegacy from 'mc-assets/dist/itemsAtlasLegacy.png'
import christmasPack from 'mc-assets/dist/textureReplacements/christmas'
import { AtlasParser, getLoadedItemDefinitionsStore } from 'mc-assets'
import TypedEmitter from 'typed-emitter'
import { ItemsRenderer } from 'mc-assets/dist/itemsRenderer'
import worldBlockProvider, { WorldBlockProvider } from 'mc-assets/dist/worldBlockProvider'
import { playerState, PlayerStateManager } from './mineflayer/playerState'
import { createNotificationProgressReporter, ProgressReporter } from './core/progressReporter'
import { setLoadingScreenStatus } from './appStatus'
import { activeModalStack, miscUiState } from './globalState'
import { options } from './optionsStorage'

export interface WorldReactiveState {
  chunksLoaded: number
  chunksTotal: number
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
  getDebugOverlay: () => Record<string, any>
  updateCamera: (pos: Vec3 | null, yaw: number, pitch: number) => void
  setRoll: (roll: number) => void
  worldState: WorldReactiveState
}

export class AppViewer {
  resourcesManager: ResourcesManager = new ResourcesManager()
  worldView: WorldDataEmitter
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
      // await this.backend.updateResources(version, progressReporter)
    }
  }

  async startWorld (world, renderDistance, startPosition) {
    this.worldView = new WorldDataEmitter(world, renderDistance, startPosition)
    window.worldView = this.worldView

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

export interface UpdateAssetsRequest {
  includeOnlyBlocks?: string[]
}

type ResourceManagerEvents = {
  assetsTexturesUpdated: () => void
}

export class ResourcesManager extends (EventEmitter as new () => TypedEmitter<ResourceManagerEvents>) {
  // Source data (imported, not changing)
  sourceBlockStatesModels: any = null
  sourceBlocksAtlases: any = blocksAtlases
  sourceItemsAtlases: any = itemsAtlases
  sourceItemDefinitionsJson: any = itemDefinitionsJson
  itemsDefinitionsStore = getLoadedItemDefinitionsStore(this.sourceItemDefinitionsJson)

  // Atlas parsers
  itemsAtlasParser: AtlasParser | undefined
  blocksAtlasParser: AtlasParser | undefined

  // User data (specific to current resourcepack/version)
  customBlockStates?: Record<string, any>
  customModels?: Record<string, any>
  customTextures: {
    items?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    blocks?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    armor?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
  } = {}

  // Moved from WorldRendererCommon
  itemsRenderer: ItemsRenderer | undefined
  worldBlockProvider: WorldBlockProvider | undefined
  blockstatesModels: any = null

  version?: string
  texturesVersion?: string

  async updateAssetsData (request: UpdateAssetsRequest = {}) {
    const blocksAssetsParser = new AtlasParser(this.sourceBlocksAtlases, blocksAtlasLatest, blocksAtlasLegacy)
    const itemsAssetsParser = new AtlasParser(this.sourceItemsAtlases, itemsAtlasLatest, itemsAtlasLegacy)

    const blockTexturesChanges = {} as Record<string, string>
    const date = new Date()
    if ((date.getMonth() === 11 && date.getDate() >= 24) || (date.getMonth() === 0 && date.getDate() <= 6)) {
      Object.assign(blockTexturesChanges, christmasPack)
    }

    const customBlockTextures = Object.keys(this.customTextures.blocks?.textures ?? {})
    const customItemTextures = Object.keys(this.customTextures.items?.textures ?? {})

    console.time('createBlocksAtlas')
    const { atlas: blocksAtlas, canvas: blocksCanvas } = await blocksAssetsParser.makeNewAtlas(
      this.texturesVersion ?? this.version ?? 'latest',
      (textureName) => {
        if (request.includeOnlyBlocks && !request.includeOnlyBlocks.includes(textureName)) return false
        const texture = this.customTextures?.blocks?.textures[textureName]
        return blockTexturesChanges[textureName] ?? texture
      },
      undefined,
      undefined,
      customBlockTextures
    )
    console.timeEnd('createBlocksAtlas')

    console.time('createItemsAtlas')
    const { atlas: itemsAtlas, canvas: itemsCanvas } = await itemsAssetsParser.makeNewAtlas(
      this.texturesVersion ?? this.version ?? 'latest',
      (textureName) => {
        const texture = this.customTextures?.items?.textures[textureName]
        if (!texture) return
        return texture
      },
      this.customTextures?.items?.tileSize,
      undefined,
      customItemTextures
    )
    console.timeEnd('createItemsAtlas')

    this.blocksAtlasParser = new AtlasParser({ latest: blocksAtlas }, blocksCanvas.toDataURL())
    this.itemsAtlasParser = new AtlasParser({ latest: itemsAtlas }, itemsCanvas.toDataURL())

    // Initialize ItemsRenderer and WorldBlockProvider
    if (this.version && this.blockstatesModels && this.itemsAtlasParser && this.blocksAtlasParser) {
      this.itemsRenderer = new ItemsRenderer(
        this.version,
        this.blockstatesModels,
        this.itemsAtlasParser,
        this.blocksAtlasParser
      )
      this.worldBlockProvider = worldBlockProvider(
        this.blockstatesModels,
        this.blocksAtlasParser.atlas,
        'latest'
      )
    }

    // Emit event that textures were updated
    this.emit('assetsTexturesUpdated')

    return {
      blocksAtlas,
      itemsAtlas,
      blocksCanvas,
      itemsCanvas
    }
  }

  async setVersion (version: string, texturesVersion?: string) {
    this.version = version
    this.texturesVersion = texturesVersion
    await this.updateAssetsData()
  }
}

export const appViewer = new AppViewer()
window.appViewer = appViewer

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
