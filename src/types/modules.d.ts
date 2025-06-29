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

// Vec3 module declarations
declare module 'vec3' {
  export class Vec3 {
    constructor (x?: number, y?: number, z?: number)
    x: number
    y: number
    z: number

    set (x: number, y: number, z: number): this
    add (other: Vec3): Vec3
    subtract (other: Vec3): Vec3
    multiply (scalar: number): Vec3
    divide (scalar: number): Vec3
    dot (other: Vec3): number
    cross (other: Vec3): Vec3
    length (): number
    normalize (): Vec3
    distance (other: Vec3): number
    equals (other: Vec3): boolean
    clone (): Vec3
    offset (dx: number, dy: number, dz: number): Vec3
    plus (other: Vec3): Vec3
    minus (other: Vec3): Vec3
    scaled (scalar: number): Vec3
    abs (): Vec3
    floor (): Vec3
    ceil (): Vec3
    round (): Vec3
    translate (dx: number, dy: number, dz: number): Vec3
    toString (): string
    toArray (): [number, number, number]

    static fromArray (arr: [number, number, number]): Vec3
  }
  export default Vec3
}

// Prismarine-nbt module declarations
declare module 'prismarine-nbt' {
  export interface NBTData {
    name: string
    value: any
    type: string
  }

  export interface ParsedNBT {
    parsed: NBTData
    type: string
    metadata: any
  }

  export function parse (buffer: Buffer, littleEndian?: boolean): Promise<ParsedNBT>
  export function parseUncompressed (buffer: Buffer, littleEndian?: boolean): ParsedNBT
  export function writeUncompressed (value: any, littleEndian?: boolean): Buffer
  export function simplify (data: any): any
  export function serialize (nbt: any): Buffer

  export class Writer {
    constructor (littleEndian?: boolean)
    writeTag (tag: any): void
    getBuffer (): Buffer
  }

  export class Reader {
    constructor (buffer: Buffer, littleEndian?: boolean)
    readTag (): any
  }

  export default {
    parse,
    parseUncompressed,
    writeUncompressed,
    simplify,
    serialize,
    Writer,
    Reader
  }
}

// @tweenjs/tween.js module declarations
declare module '@tweenjs/tween.js' {
  export interface TweenEasing {
    Linear: {
      None (k: number): number
    }
    Quadratic: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Cubic: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Quartic: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Quintic: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Sinusoidal: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Exponential: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Circular: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Elastic: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Back: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
    Bounce: {
      In (k: number): number
      Out (k: number): number
      InOut (k: number): number
    }
  }

  export class Tween<T extends Record<string, any>> {
    constructor (object: T, group?: Group)
    to (properties: Partial<T>, duration: number): this
    start (time?: number): this
    stop (): this
    end (): this
    stopChainedTweens (): this
    group (group: Group): this
    delay (amount: number): this
    repeat (times: number): this
    repeatDelay (amount: number): this
    yoyo (yoyo: boolean): this
    easing (easingFunction: (k: number) => number): this
    interpolation (interpolationFunction: (v: number[], k: number) => number): this
    chain (...tweens: Tween<any>[]): this
    onStart (callback: (object: T) => void): this
    onUpdate (callback: (object: T, elapsed: number) => void): this
    onRepeat (callback: (object: T) => void): this
    onComplete (callback: (object: T) => void): this
    onStop (callback: (object: T) => void): this
    update (time: number): boolean
    isPlaying (): boolean
    isPaused (): boolean
    pause (time?: number): this
    resume (time?: number): this
    duration (duration?: number): number
    getDuration (): number
    getId (): number
  }

  export class Group {
    constructor ()
    getAll (): Tween<any>[]
    removeAll (): void
    add (tween: Tween<any>): void
    remove (tween: Tween<any>): void
    update (time?: number): boolean
  }

  export const Easing: TweenEasing

  export function update (time?: number): boolean
  export function getAll (): Tween<any>[]
  export function removeAll (): void
  export function add (tween: Tween<any>): void
  export function remove (tween: Tween<any>): void
  export function now (): number

  export default {
    Tween,
    Group,
    Easing,
    update,
    getAll,
    removeAll,
    add,
    remove,
    now
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

declare module 'valtio/vanilla' {
  export function proxy<T extends object>(initialObject: T): T
  export function subscribe<T>(proxy: T, callback: (ops: any[]) => void): () => void
  export function snapshot<T extends object>(proxy: T): Readonly<T>
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

declare module 'three/addons/controls/OrbitControls.js' {
  export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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

// Additional commonly used modules
declare module 'stats.js' {
  export default class Stats {
    constructor ()
    dom: HTMLDivElement
    begin (): void
    end (): void
    update (): void
    setMode (mode: number): void
    showPanel (panel: number): void
  }
}

declare module 'debug' {
  interface Debug {
    (namespace: string): Debugger
    enabled (namespaces: string): boolean
    humanize (val: number): string
    names: RegExp[]
    skips: RegExp[]
    formatters: Record<string, (v: any) => string>
  }

  interface Debugger {
    (formatter: any, ...args: any[]): void
    enabled: boolean
    log: (...args: any[]) => any
    namespace: string
    destroy (): boolean
    extend (namespace: string, delimiter?: string): Debugger
  }

  const debug: Debug
  export = debug
}

// Enhanced events module with missing methods
declare module 'events' {
  export class EventEmitter {
    static defaultMaxListeners: number
    
    constructor ()
    on (event: string, listener: (...args: any[]) => void): this
    once (event: string, listener: (...args: any[]) => void): this
    emit (event: string, ...args: any[]): boolean
    off (event: string, listener: (...args: any[]) => void): this
    removeListener (event: string, listener: (...args: any[]) => void): this
    removeAllListeners (event?: string): this
    listeners (event: string): Function[]
    listenerCount (event: string): number
    addListener (event: string, listener: (...args: any[]) => void): this
    prependListener (event: string, listener: (...args: any[]) => void): this
    prependOnceListener (event: string, listener: (...args: any[]) => void): this
    setMaxListeners (n: number): this
    getMaxListeners (): number
    eventNames (): Array<string | symbol>
    rawListeners (event: string): Function[]
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

// Enhanced bot client interface
interface BotClient {
  on (event: string, callback: (...args: any[]) => void): void
  prependListener (event: string, callback: (...args: any[]) => void): void
  write<T extends keyof any> (name: T, data: any): Buffer
}

// Global bot interface enhancement
declare global {
  const bot: {
    entity?: BotEntity
    _client?: BotClient
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