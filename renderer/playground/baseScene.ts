import { Vec3 } from 'vec3'
import * as THREE from 'three'
import '../../src/getCollisionShapes'
import { IndexedData } from 'minecraft-data'
import BlockLoader from 'prismarine-block'
import ChunkLoader from 'prismarine-chunk'
import WorldLoader from 'prismarine-world'
import { proxy } from 'valtio'

//@ts-expect-error
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
// eslint-disable-next-line import/no-named-as-default
import GUI from 'lil-gui'
import _ from 'lodash'
import { GraphicsBackendConfig } from '../../src/appViewer'
import { ResourcesManager } from '../../src/resourcesManager'
import supportedVersions from '../../src/supportedVersions.mjs'
import { toMajorVersion } from '../../src/utils'
import { BlockNames } from '../../src/mcDataTypes'
import { defaultWorldRendererConfig, WorldRendererConfig } from '../viewer/lib/worldrendererCommon'
import { WorldDataEmitter } from '../viewer/lib/worldDataEmitter'
import { getInitialPlayerState } from '../viewer/lib/basePlayerState'
import createGraphicsBackend from '../viewer/three/graphicsBackend'
import { WorldRendererThree } from '../viewer/three/worldrendererThree'
import { getSyncWorld } from './shared'

window.THREE = THREE

// Scene configuration interface
export interface PlaygroundSceneConfig {
  version?: string
  viewDistance?: number
  targetPos?: Vec3
  enableCameraControls?: boolean
  enableCameraOrbitControl?: boolean
  worldConfig?: WorldRendererConfig
  continuousRender?: boolean
}

const includedVersions = globalThis.includedVersions ?? supportedVersions

export class BasePlaygroundScene {
  // Rendering state
  continuousRender = false
  stopRender = false
  windowHidden = false

  // Scene configuration
  viewDistance = 0
  targetPos = new Vec3(2, 90, 2)
  version: string = new URLSearchParams(window.location.search).get('version') || includedVersions.at(-1)!

  // World data
  Chunk: typeof import('prismarine-chunk/types/index').PCChunk
  Block: typeof import('prismarine-block').Block
  world: ReturnType<typeof getSyncWorld>

  // GUI
  gui = new GUI()
  params = {} as Record<string, any>
  paramOptions = {} as Partial<Record<keyof typeof this.params, {
    hide?: boolean
    options?: string[]
    min?: number
    max?: number
    reloadOnChange?: boolean
  }>>
  onParamUpdate = {} as Record<string, () => void>
  alwaysIgnoreQs = [] as string[]
  skipUpdateQs = false

  // Camera controls
  enableCameraControls = true
  enableCameraOrbitControl = true
  controls: OrbitControls | undefined

  // Renderer infrastructure (modern architecture)
  resourcesManager: ResourcesManager
  graphicsBackend: ReturnType<typeof createGraphicsBackend> | undefined
  worldRenderer: WorldRendererThree | undefined
  worldView: WorldDataEmitter | undefined

  // World config - must be a valtio proxy for reactive updates
  _worldConfig = proxy({ ...defaultWorldRendererConfig })
  get worldConfig () {
    return this._worldConfig
  }
  set worldConfig (value) {
    // Merge the new values into the existing proxy to maintain reactivity
    Object.assign(this._worldConfig, value)
    // World config is passed via DisplayWorldOptions, not directly on worldRenderer
    // We'll update it when recreating the world if needed
  }

  constructor (config: PlaygroundSceneConfig = {}) {
    // Apply config
    if (config.version) this.version = config.version

    // Ensure version is always set (fallback to latest supported version)
    if (!this.version) {
      throw new Error('Minecraft version is not set')
    }

    if (config.viewDistance !== undefined) this.viewDistance = config.viewDistance
    if (config.targetPos) this.targetPos = config.targetPos
    if (config.enableCameraControls !== undefined) this.enableCameraControls = config.enableCameraControls
    if (config.enableCameraOrbitControl !== undefined) this.enableCameraOrbitControl = config.enableCameraOrbitControl
    if (config.worldConfig) {
      // Merge config into the proxy to maintain reactivity
      Object.assign(this._worldConfig, config.worldConfig)
    }
    if (config.continuousRender !== undefined) this.continuousRender = config.continuousRender

    // Initialize resources manager
    this.resourcesManager = new ResourcesManager()

    void this.initData().then(() => {
      this.addKeyboardShortcuts()
    })
  }

  onParamsUpdate (paramName: string, object: any) {}

  updateQs (paramName: string, valueSet: any) {
    if (this.skipUpdateQs) return
    const newQs = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries({ [paramName]: valueSet })) {
      if (typeof value === 'function' || this.params.skipQs?.includes(key) || this.alwaysIgnoreQs.includes(key)) continue
      if (value) {
        newQs.set(key, value)
      } else {
        newQs.delete(key)
      }
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${newQs.toString()}`)
  }

  renderFinish () {
    this.render()
  }

  initGui () {
    const qs = new URLSearchParams(window.location.search)
    for (const key of Object.keys(this.params)) {
      const value = qs.get(key)
      if (!value) continue
      const parsed = /^-?\d+$/.test(value) ? Number(value) : value === 'true' ? true : value === 'false' ? false : value
      this.params[key] = parsed
    }

    for (const param of Object.keys(this.params)) {
      const option = this.paramOptions[param]
      if (option?.hide) continue
      this.gui.add(this.params, param, option?.options ?? option?.min, option?.max)
    }
    if (window.innerHeight < 700) {
      this.gui.open(false)
    } else {
      setTimeout(() => {
        this.gui.domElement.classList.remove('transition')
      }, 500)
    }

    this.gui.onChange(({ property, object }) => {
      if (object === this.params) {
        this.onParamUpdate[property]?.()
        this.onParamsUpdate(property, object)
        const value = this.params[property]
        if (this.paramOptions[property]?.reloadOnChange && (typeof value === 'boolean' || this.paramOptions[property].options)) {
          setTimeout(() => {
            window.location.reload()
          })
        }
        this.updateQs(property, value)
      } else {
        this.onParamsUpdate(property, object)
      }
    })
  }

  // Overridable methods
  setupWorld () { }
  sceneReset () {}

  // eslint-disable-next-line max-params
  addWorldBlock (xOffset: number, yOffset: number, zOffset: number, blockName: BlockNames, properties?: Record<string, any>) {
    if (xOffset > 16 || yOffset > 16 || zOffset > 16) throw new Error('Offset too big')
    const block =
      properties ?
        this.Block.fromProperties(loadedData.blocksByName[blockName].id, properties ?? {}, 0) :
        this.Block.fromStateId(loadedData.blocksByName[blockName].defaultState, 0)
    this.world.setBlock(this.targetPos.offset(xOffset, yOffset, zOffset), block)
  }

  resetCamera () {
    if (!this.worldRenderer) return
    const { targetPos } = this
    this.controls?.target.set(targetPos.x + 0.5, targetPos.y + 0.5, targetPos.z + 0.5)

    const cameraPos = targetPos.offset(2, 2, 2)
    const pitch = THREE.MathUtils.degToRad(-45)
    const yaw = THREE.MathUtils.degToRad(45)
    this.worldRenderer.camera.rotation.set(pitch, yaw, 0, 'ZYX')
    this.worldRenderer.camera.lookAt(targetPos.x + 0.5, targetPos.y + 0.5, targetPos.z + 0.5)
    this.worldRenderer.camera.position.set(cameraPos.x + 0.5, cameraPos.y + 0.5, cameraPos.z + 0.5)
    this.controls?.update()
  }

  async initData () {
    await window._LOAD_MC_DATA()
    const mcData: IndexedData = require('minecraft-data')(this.version)
    window.loadedData = window.mcData = mcData

    this.Chunk = (ChunkLoader as any)(this.version)
    this.Block = (BlockLoader as any)(this.version)

    const world = getSyncWorld(this.version)
    world.setBlockStateId(this.targetPos, 0)
    this.world = world

    this.initGui()

    // Create world view
    const worldView = new WorldDataEmitter(world, this.viewDistance, this.targetPos)
    worldView.addWaitTime = 0
    this.worldView = worldView
    window.worldView = worldView

    // Initialize resources manager
    this.resourcesManager.currentConfig = { version: this.version, noInventoryGui: true }
    await this.resourcesManager.loadSourceData(this.version)
    await this.resourcesManager.updateAssetsData({})

    // Create graphics backend using modern architecture
    const graphicsConfig: GraphicsBackendConfig = {
      sceneBackground: 'lightblue',
      powerPreference: undefined,
      fpsLimit: undefined,
      statsVisible: 0,
      timeoutRendering: false
    }

    const initOptions = {
      resourcesManager: this.resourcesManager as any, // Type assertion needed for playground mode
      config: graphicsConfig,
      rendererSpecificSettings: {},
      callbacks: {
        displayCriticalError (error: Error) {
          console.error('Graphics error:', error)
        },
        setRendererSpecificSettings () {},
        fireCustomEvent () {}
      }
    }

    // Create graphics backend (it creates DocumentRenderer internally and sets up render loop)
    this.graphicsBackend = await createGraphicsBackend(initOptions)

    // Canvas is created by DocumentRenderer inside graphicsBackend
    // Ensure it has the right ID
    if (!document.querySelector('#viewer-canvas') && globalThis.renderer) {
      const rendererCanvas = (globalThis.renderer as THREE.WebGLRenderer).domElement
      rendererCanvas.id = 'viewer-canvas'
    }

    // Create display options for world
    const playerStateReactive = proxy(getInitialPlayerState())
    const rendererState = proxy({
      world: {
        chunksLoaded: new Set<string>(),
        heightmaps: new Map<string, Uint8Array>(),
        allChunksLoaded: false,
        mesherWork: false,
        intersectMedia: null
      },
      renderer: 'threejs',
      preventEscapeMenu: false
    })
    const nonReactiveState = {
      world: {
        chunksLoaded: new Set<string>(),
        chunksTotalNumber: 0
      }
    }

    const displayOptions = {
      version: this.version,
      worldView: worldView as any,
      inWorldRenderingConfig: this.worldConfig,
      playerStateReactive,
      rendererState,
      nonReactiveState
    }

    // Start world using graphics backend
    // This creates WorldRendererThree internally and sets window.world
    await this.graphicsBackend.startWorld(displayOptions)

    // Get world renderer from window.world (set by graphicsBackend.startWorld)
    this.worldRenderer = window.world as WorldRendererThree
    window.viewer = this.worldRenderer // For backward compatibility with old scenes

    if (!this.worldRenderer) {
      throw new Error('Failed to create world renderer')
    }

    // Configure world renderer
    // Note: addChunksBatchWaitTime is in worldConfig, not directly on worldRenderer
    this.worldRenderer.entities.setDebugMode('basic')
    // mesherConfig is accessed through inWorldRenderingConfig which is in displayOptions
    // We can update it via the config that was passed
    this.worldRenderer.entities.onSkinUpdate = () => {
      this.render()
    }

    // Setup world
    this.setupWorld()

    // Initialize world view
    await worldView.init(this.targetPos)

    // Setup camera controls
    if (this.enableCameraControls) {
      const canvas = document.querySelector('#viewer-canvas')
      if (canvas && this.worldRenderer) {
        const controls = this.enableCameraOrbitControl
          ? new OrbitControls(this.worldRenderer.camera, canvas as HTMLElement)
          : undefined
        this.controls = controls

        this.resetCamera()

        // Camera position from query string or localStorage
        const cameraSet = this.params.camera || localStorage.camera
        if (cameraSet) {
          const [x, y, z, rx, ry] = cameraSet.split(',').map(Number)
          this.worldRenderer.camera.position.set(x, y, z)
          this.worldRenderer.camera.rotation.set(rx, ry, 0, 'ZYX')
          this.controls?.update()
        }

        const throttledCamQsUpdate = _.throttle(() => {
          if (!this.worldRenderer) return
          const { camera } = this.worldRenderer
          localStorage.camera = [
            camera.position.x.toFixed(2),
            camera.position.y.toFixed(2),
            camera.position.z.toFixed(2),
            camera.rotation.x.toFixed(2),
            camera.rotation.y.toFixed(2),
          ].join(',')
        }, 200)

        if (this.controls) {
          this.controls.addEventListener('change', () => {
            throttledCamQsUpdate()
            this.render()
          })
        } else {
          setInterval(() => {
            throttledCamQsUpdate()
          }, 200)
        }
      }
    }

    // Manual camera controls (if orbit controls disabled)
    if (!this.enableCameraOrbitControl && this.worldRenderer) {
      let mouseMoveCounter = 0
      const mouseMove = (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest('.lil-gui')) return
        if (e.buttons === 1 || e.pointerType === 'touch') {
          mouseMoveCounter++
          this.worldRenderer!.camera.rotation.x -= e.movementY / 100
          this.worldRenderer!.camera.rotation.y -= e.movementX / 100
          if (this.worldRenderer!.camera.rotation.x < -Math.PI / 2) this.worldRenderer!.camera.rotation.x = -Math.PI / 2
          if (this.worldRenderer!.camera.rotation.x > Math.PI / 2) this.worldRenderer!.camera.rotation.x = Math.PI / 2
        }
        if (e.buttons === 2) {
          this.worldRenderer!.camera.position.set(0, 0, 0)
        }
      }
      setInterval(() => {
        mouseMoveCounter = 0
      }, 1000)
      window.addEventListener('pointermove', mouseMove)
    }

    // Setup resize handler
    this.onResize()
    window.addEventListener('resize', () => this.onResize())

    // Wait for chunks and finish setup
    void this.worldRenderer.waitForChunksToRender().then(async () => {
      this.renderFinish()
    })

    // Listen for world updates
    this.worldRenderer.renderUpdateEmitter.addListener('update', () => {
      this.render()
    })

    // Start render loop if needed
    this.loop()
  }

  loop () {
    if (this.continuousRender && !this.windowHidden) {
      this.render(true)
      requestAnimationFrame(() => this.loop())
    }
  }

  render (fromLoop = false) {
    if (!fromLoop && this.continuousRender) return
    if (this.stopRender) return
    if (!this.worldRenderer) return

    // Render is handled by DocumentRenderer's render loop (created by graphicsBackend)
    // For continuous render mode, we trigger a render manually
    // The normal render loop is already running via DocumentRenderer
    if (fromLoop) {
      // Trigger a render by calling the worldRenderer directly
      // The DocumentRenderer's loop will handle the actual rendering
      this.worldRenderer.render(false)
    }
  }

  addKeyboardShortcuts () {
    document.addEventListener('keydown', (e) => {
      if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.code === 'KeyR') {
          this.controls?.reset()
          this.resetCamera()
        }
        if (e.code === 'KeyE') { // refresh block (main)
          this.worldView!.setBlockStateId(this.targetPos, this.world.getBlockStateId(this.targetPos))
        }
        if (e.code === 'KeyF') { // reload all chunks
          this.sceneReset()
          this.worldView!.unloadAllChunks()
          void this.worldView!.init(this.targetPos)
        }
      }
    })
    document.addEventListener('visibilitychange', () => {
      this.windowHidden = document.visibilityState === 'hidden'
    })
    document.addEventListener('blur', () => {
      this.windowHidden = true
    })
    document.addEventListener('focus', () => {
      this.windowHidden = false
    })

    const pressedKeys = new Set<string>()
    const updateKeys = () => {
      if (pressedKeys.has('ControlLeft') || pressedKeys.has('MetaLeft')) {
        return
      }
      if (!this.worldRenderer) return

      const direction = new THREE.Vector3(0, 0, 0)
      if (pressedKeys.has('KeyW')) {
        direction.z = -0.5
      }
      if (pressedKeys.has('KeyS')) {
        direction.z += 0.5
      }
      if (pressedKeys.has('KeyA')) {
        direction.x -= 0.5
      }
      if (pressedKeys.has('KeyD')) {
        direction.x += 0.5
      }

      if (pressedKeys.has('ShiftLeft')) {
        this.worldRenderer.camera.position.y -= 0.5
      }
      if (pressedKeys.has('Space')) {
        this.worldRenderer.camera.position.y += 0.5
      }
      direction.applyQuaternion(this.worldRenderer.camera.quaternion)
      direction.y = 0

      if (pressedKeys.has('ShiftLeft')) {
        direction.y *= 2
        direction.x *= 2
        direction.z *= 2
      }
      this.worldRenderer.camera.position.add(direction.normalize())
      this.controls?.update()
      this.render()
    }
    setInterval(updateKeys, 1000 / 30)

    const keys = (e: KeyboardEvent) => {
      const { code } = e
      const pressed = e.type === 'keydown'
      if (pressed) {
        pressedKeys.add(code)
      } else {
        pressedKeys.delete(code)
      }
    }

    window.addEventListener('keydown', keys)
    window.addEventListener('keyup', keys)
    window.addEventListener('blur', () => {
      for (const key of pressedKeys) {
        keys(new KeyboardEvent('keyup', { code: key }))
      }
    })
  }

  onResize () {
    if (!this.worldRenderer || !globalThis.renderer) return

    const { camera } = this.worldRenderer
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    const renderer = globalThis.renderer as THREE.WebGLRenderer
    renderer.setSize(window.innerWidth, window.innerHeight)

    this.render()
  }
}
