/**
 * Enhanced module declarations for better type safety in the Minecraft web client
 * Provides type definitions for external modules and enhances existing ones
 */

// Enhanced THREE.js type augmentations
declare module 'three' {
  interface Material {
    map?: Texture | null
  }
  
  interface SpriteMaterial extends Material {
    map?: Texture | null
    transparent?: boolean
    alphaTest?: number
    blending?: Blending
    depthTest?: boolean
    depthWrite?: boolean
    color?: Color
  }
}

// mc-assets module declarations with enhanced types
declare module 'mc-assets' {
  export interface AtlasParser {
    atlas: {
      latest: {
        tileSize: number
        width: number
        height: number
        textures: Record<string, TextureInfo>
        suSv: number
      }
    }
    latestImage?: string
    getTextureInfo(name: string): TextureInfo | null | undefined
    createDebugImage(includeText?: boolean): Promise<string>
    makeNewAtlas(...args: any[]): Promise<{ atlas: any, canvas: HTMLCanvasElement }>
  }

  export interface TextureInfo {
    u: number
    v: number
    width?: number
    height?: number
    su?: number
    sv?: number
  }

  export interface BlockModel {
    elements?: any[]
    textures?: Record<string, string>
    display?: Record<string, any>
    gui_light?: string
    tints?: any
    [key: string]: any
  }

  export interface ItemsAtlasesOutputJson {
    tileSize: number
    width: number
    height: number
    textures: Record<string, TextureInfo>
    suSv: number
  }
}

declare module 'mc-assets/dist/utils' {
  export function getLoadedImage(src: string | HTMLImageElement): Promise<HTMLImageElement>
  export function versionToNumber(version: string): number
}

declare module 'mc-assets/dist/atlasParser' {
  export { AtlasParser, ItemsAtlasesOutputJson } from 'mc-assets'
}

declare module 'mc-assets/dist/worldBlockProvider' {
  export interface WorldBlockProvider {
    getBlockModel(name: string): any
    getTextureUV(textureName: string): number[] | undefined
  }
  
  export default function worldBlockProvider(
    blockstatesModels: any,
    atlas: any,
    version: string
  ): WorldBlockProvider
}

declare module 'mc-assets/dist/itemsRenderer' {
  export interface ItemsRendererConstructor {
    new (
      version: string,
      blockstatesModels: any,
      itemsAtlasParser: any,
      blocksAtlasParser: any
    ): any
  }
  export const ItemsRenderer: ItemsRendererConstructor
}

declare module 'mc-assets/dist/itemDefinitions' {
  export interface ItemSelector {
    properties?: {
      'minecraft:using_item'?: boolean
      'minecraft:use_duration'?: number
      'minecraft:use_cycle'?: number
      'minecraft:display_context'?: string
    }
  }

  export function getItemDefinition(store: any, selector: any): any
  export function getLoadedItemDefinitionsStore(data: any): any
}

// Enhanced valtio type declarations
declare module 'valtio' {
  export function proxy<T extends object>(initialObject: T): T
  export function subscribe<T>(proxy: T, callback: (ops: any[]) => void): () => void
  export function ref<T>(obj: T): T
  export function useSnapshot<T extends object>(proxy: T): Readonly<T>
}

declare module 'valtio/utils' {
  export function subscribeKey<T extends object, K extends keyof T>(
    proxy: T,
    key: K,
    callback: (value: T[K]) => void
  ): () => void
}

// Three.js addon modules
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import { Camera, EventDispatcher } from 'three'
  
  export interface OrbitControlsConstructor {
    new (object: Camera, domElement?: HTMLElement): OrbitControlsInstance
  }

  export interface OrbitControlsInstance extends EventDispatcher {
    enabled: boolean
    enableDamping: boolean
    dampingFactor: number
    update(): boolean
    dispose(): void
  }

  export const OrbitControls: OrbitControlsConstructor
}

declare module 'three/examples/jsm/webxr/VRButton.js' {
  import { WebGLRenderer } from 'three'
  
  export const VRButton: {
    createButton(renderer: WebGLRenderer): HTMLElement
  }
}

declare module 'three-stdlib' {
  import { Material, Object3D, BufferGeometry, Vector2 } from 'three'

  export class LineMaterial extends Material {
    constructor (parameters?: any)
    color: any
    linewidth: number
    resolution: Vector2
    dashOffset: number
  }

  export class LineSegmentsGeometry extends BufferGeometry {
    constructor ()
    setPositions (positions: number[]): this
    fromEdgesGeometry (geometry: BufferGeometry): this
  }

  export class Wireframe extends Object3D {
    constructor (geometry?: BufferGeometry, material?: Material)
    computeLineDistances (): void
  }

  export class OBJLoader {
    constructor ()
    load (url: string, onLoad?: (object: any) => void): void
    parse (data: string): Object3D
  }
}

// Browser API enhancements
interface Window {
  playerState?: {
    setOnFire(value: boolean): void
    reactive: {
      onFire: boolean
    }
  }
  debugFireEffect?: boolean
}

// Enhanced canvas and WebGL types
interface OffscreenCanvas {
  convertToBlob(options?: { type?: string, quality?: number }): Promise<Blob>
  getContext(contextId: '2d'): OffscreenCanvasRenderingContext2D | null
  getContext(contextId: 'webgl' | 'webgl2'): WebGLRenderingContext | null
}

interface OffscreenCanvasRenderingContext2D {
  drawImage(
    image: HTMLImageElement | ImageBitmap,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number
  ): void
  drawImage(image: HTMLImageElement | ImageBitmap, dx: number, dy: number): void
}

// Bot entity type enhancements for fire detection
interface BotEntity {
  onFire?: boolean
  fireTicks?: number
  fire?: number
  effects?: Record<string, { id: number }>
  position: { x: number, y: number, z: number }
  yaw: number
  pitch: number
  onGround: boolean
  velocity: { x: number, y: number, z: number }
}

// Global bot interface enhancement
declare global {
  const bot: {
    entity?: BotEntity
    game?: {
      gameMode?: string
      dimension?: string
    }
    username?: string
    inventory?: {
      slots: any[]
    }
    heldItem?: any
    controlState?: {
      sneak: boolean
    }
    _client?: {
      on(event: string, callback: (...args: any[]) => void): void
    }
    on(event: string, callback: (...args: any[]) => void): void
  }
  
  const loadedData: {
    effects?: Record<number, { name: string }>
    blocksByName?: Record<string, any>
    items?: Record<number, { name: string }>
    blocksByStateId?: Record<number, { name: string }>
  }

  const customEvents: {
    on(event: string, callback: (...args: any[]) => void): void
  }
  
  const appViewer: {
    backend?: {
      updateCamera(position: any, yaw: number, pitch: number): void
    }
    resourcesManager: any
  }

  const PrismarineBlock: any
}

export {}