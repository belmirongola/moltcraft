import { EventEmitter } from 'events'
import TypedEmitter from 'typed-emitter'
import blocksAtlases from 'mc-assets/dist/blocksAtlases.json'
import itemsAtlases from 'mc-assets/dist/itemsAtlases.json'
import itemDefinitionsJson from 'mc-assets/dist/itemDefinitions.json'
import blocksAtlasLatest from 'mc-assets/dist/blocksAtlasLatest.png'
import blocksAtlasLegacy from 'mc-assets/dist/blocksAtlasLegacy.png'
import itemsAtlasLatest from 'mc-assets/dist/itemsAtlasLatest.png'
import itemsAtlasLegacy from 'mc-assets/dist/itemsAtlasLegacy.png'
import christmasPack from 'mc-assets/dist/textureReplacements/christmas'
import { AtlasParser } from 'mc-assets/dist/atlasParser'
import worldBlockProvider, { WorldBlockProvider } from 'mc-assets/dist/worldBlockProvider'
import { ItemsRenderer } from 'mc-assets/dist/itemsRenderer'
import { getLoadedItemDefinitionsStore } from 'mc-assets'
import { getLoadedImage } from 'mc-assets/dist/utils'
import { importLargeData } from '../generated/large-data-aliases'
import { loadMinecraftData } from './connect'

type ResourceManagerEvents = {
  assetsTexturesUpdated: () => void
}

class LoadedResources {
  // Atlas parsers
  itemsAtlasParser: AtlasParser
  blocksAtlasParser: AtlasParser
  itemsAtlasImage: HTMLImageElement
  blocksAtlasImage: HTMLImageElement

  // User data (specific to current resourcepack/version)
  customBlockStates?: Record<string, any>
  customModels?: Record<string, any>
  customTextures: {
    items?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    blocks?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    armor?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
  } = {}

  itemsRenderer: ItemsRenderer
  worldBlockProvider: WorldBlockProvider
  blockstatesModels: any = null

  version: string
  texturesVersion: string
}

export interface UpdateAssetsRequest {
  version: string
  noBlockstatesModels?: boolean
  texturesVersion?: string
  includeOnlyBlocks?: string[]
}

export class ResourcesManager extends (EventEmitter as new () => TypedEmitter<ResourceManagerEvents>) {
  // Source data (imported, not changing)
  sourceBlockStatesModels: any = null
  readonly sourceBlocksAtlases: any = blocksAtlases
  readonly sourceItemsAtlases: any = itemsAtlases
  readonly sourceItemDefinitionsJson: any = itemDefinitionsJson
  readonly itemsDefinitionsStore = getLoadedItemDefinitionsStore(this.sourceItemDefinitionsJson)

  currentResources: LoadedResources | undefined
  abortController = new AbortController()

  async loadMcData (version: string) {
    await loadMinecraftData(version)
  }

  async loadSourceData (version: string) {
    await this.loadMcData(version)
    this.sourceBlockStatesModels ??= await importLargeData('blockStatesModels')
  }

  async updateAssetsData (request: UpdateAssetsRequest) {
    const abortController = new AbortController()
    await this.loadSourceData(request.version)
    if (abortController.signal.aborted) return

    const resources = this.currentResources ?? new LoadedResources()
    resources.version = request.version
    resources.texturesVersion = request.texturesVersion ?? resources.version

    resources.blockstatesModels = {
      blockstates: {},
      models: {}
    }
    // todo-low resolve version
    resources.blockstatesModels.blockstates.latest = {
      ...this.sourceBlockStatesModels.blockstates.latest,
      ...resources.customBlockStates
    }

    resources.blockstatesModels.models.latest = {
      ...this.sourceBlockStatesModels.models.latest,
      ...resources.customModels
    }


    const blocksAssetsParser = new AtlasParser(this.sourceBlocksAtlases, blocksAtlasLatest, blocksAtlasLegacy)
    const itemsAssetsParser = new AtlasParser(this.sourceItemsAtlases, itemsAtlasLatest, itemsAtlasLegacy)

    const blockTexturesChanges = {} as Record<string, string>
    const date = new Date()
    if ((date.getMonth() === 11 && date.getDate() >= 24) || (date.getMonth() === 0 && date.getDate() <= 6)) {
      Object.assign(blockTexturesChanges, christmasPack)
    }

    const customBlockTextures = Object.keys(resources.customTextures.blocks?.textures ?? {})
    const customItemTextures = Object.keys(resources.customTextures.items?.textures ?? {})

    console.time('createBlocksAtlas')
    const { atlas: blocksAtlas, canvas: blocksCanvas } = await blocksAssetsParser.makeNewAtlas(
      resources.texturesVersion,
      (textureName) => {
        if (request.includeOnlyBlocks && !request.includeOnlyBlocks.includes(textureName)) return false
        const texture = resources.customTextures.blocks?.textures[textureName]
        return blockTexturesChanges[textureName] ?? texture
      },
      undefined,
      undefined,
      customBlockTextures
    )
    console.timeEnd('createBlocksAtlas')

    if (abortController.signal.aborted) return
    console.time('createItemsAtlas')
    const { atlas: itemsAtlas, canvas: itemsCanvas } = await itemsAssetsParser.makeNewAtlas(
      resources.texturesVersion,
      (textureName) => {
        const texture = resources.customTextures.items?.textures[textureName]
        if (!texture) return
        return texture
      },
      resources.customTextures.items?.tileSize,
      undefined,
      customItemTextures
    )
    console.timeEnd('createItemsAtlas')

    resources.blocksAtlasParser = new AtlasParser({ latest: blocksAtlas }, blocksCanvas.toDataURL())
    resources.itemsAtlasParser = new AtlasParser({ latest: itemsAtlas }, itemsCanvas.toDataURL())
    resources.blocksAtlasImage = await getLoadedImage(blocksCanvas.toDataURL())
    resources.itemsAtlasImage = await getLoadedImage(itemsCanvas.toDataURL())

    if (resources.version && resources.blockstatesModels && resources.itemsAtlasParser && resources.blocksAtlasParser) {
      resources.itemsRenderer = new ItemsRenderer(
        resources.version,
        resources.blockstatesModels,
        resources.itemsAtlasParser,
        resources.blocksAtlasParser
      )
      resources.worldBlockProvider = worldBlockProvider(
        resources.blockstatesModels,
        resources.blocksAtlasParser.atlas,
        'latest'
      )
    }

    if (abortController.signal.aborted) return

    this.emit('assetsTexturesUpdated')

    this.currentResources = resources
  }

  async downloadDebugAtlas (isItems = false) {
    const resources = this.currentResources
    if (!resources) throw new Error('No resources loaded')
    const atlasParser = (isItems ? resources.itemsAtlasParser : resources.blocksAtlasParser)!
    const dataUrl = await atlasParser.createDebugImage(true)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `atlas-debug-${isItems ? 'items' : 'blocks'}.png`
    a.click()
  }

  destroy () {
    this.abortController.abort()
    this.currentResources = undefined
    this.abortController = new AbortController()
  }
}
