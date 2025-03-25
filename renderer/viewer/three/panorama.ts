import { join } from 'path'
import * as THREE from 'three'
import { getSyncWorld } from 'renderer/playground/shared'
import { Vec3 } from 'vec3'
import * as tweenJs from '@tweenjs/tween.js'
import type { GraphicsInitOptions } from '../../../src/appViewer'
import { WorldDataEmitter } from '../lib/worldDataEmitter'
import { defaultWorldRendererConfig } from '../lib/worldrendererCommon'
import { BasePlayerState } from '../lib/basePlayerState'
import { getDefaultRendererState } from '../baseGraphicsBackend'
import { WorldRendererThree } from './worldrendererThree'
import { EntityMesh } from './entity/EntityMesh'
import { DocumentRenderer } from './documentRenderer'

const panoramaFiles = [
  'panorama_3.png', // right (+x)
  'panorama_1.png', // left (-x)
  'panorama_4.png', // top (+y)
  'panorama_5.png', // bottom (-y)
  'panorama_0.png', // front (+z)
  'panorama_2.png', // back (-z)
]

export class PanoramaRenderer {
  private readonly camera: THREE.PerspectiveCamera
  private scene: THREE.Scene
  private readonly ambientLight: THREE.AmbientLight
  private readonly directionalLight: THREE.DirectionalLight
  private panoramaGroup: THREE.Object3D | null = null
  private time = 0
  private readonly abortController = new AbortController()
  private worldRenderer: WorldRendererThree | undefined

  constructor (private readonly documentRenderer: DocumentRenderer, private readonly options: GraphicsInitOptions, private readonly doWorldBlocksPanorama = false) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.options.config.sceneBackground)

    // Add ambient light
    this.ambientLight = new THREE.AmbientLight(0xcc_cc_cc)
    this.scene.add(this.ambientLight)

    // Add directional light
    this.directionalLight = new THREE.DirectionalLight(0xff_ff_ff, 0.5)
    this.directionalLight.position.set(1, 1, 0.5).normalize()
    this.directionalLight.castShadow = true
    this.scene.add(this.directionalLight)

    this.camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.05, 1000)
    this.camera.position.set(0, 0, 0)
    this.camera.rotation.set(0, 0, 0)
  }

  async start () {
    if (this.doWorldBlocksPanorama) {
      await this.worldBlocksPanorama()
    } else {
      this.addClassicPanorama()
    }


    this.documentRenderer.render = (sizeChanged = false) => {
      if (sizeChanged) {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
      }
      this.documentRenderer.renderer.render(this.scene, this.camera)
    }
  }

  addClassicPanorama () {
    const panorGeo = new THREE.BoxGeometry(1000, 1000, 1000)
    const loader = new THREE.TextureLoader()
    const panorMaterials = [] as THREE.MeshBasicMaterial[]

    for (const file of panoramaFiles) {
      const texture = loader.load(join('background', file))

      // Instead of using repeat/offset to flip, we'll use the texture matrix
      texture.matrixAutoUpdate = false
      texture.matrix.set(
        -1, 0, 1, 0, 1, 0, 0, 0, 1
      )

      texture.wrapS = THREE.ClampToEdgeWrapping // Changed from RepeatWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping // Changed from RepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      panorMaterials.push(new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }))
    }

    const panoramaBox = new THREE.Mesh(panorGeo, panorMaterials)
    panoramaBox.onBeforeRender = () => {
      this.time += 0.01
      panoramaBox.rotation.y = Math.PI + this.time * 0.01
      panoramaBox.rotation.z = Math.sin(-this.time * 0.001) * 0.001
    }

    const group = new THREE.Object3D()
    group.add(panoramaBox)

    // Add squids
    for (let i = 0; i < 20; i++) {
      const m = new EntityMesh('1.16.4', 'squid').mesh
      m.position.set(Math.random() * 30 - 15, Math.random() * 20 - 10, Math.random() * 10 - 17)
      m.rotation.set(0, Math.PI + Math.random(), -Math.PI / 4, 'ZYX')
      const v = Math.random() * 0.01
      m.children[0].onBeforeRender = () => {
        m.rotation.y += v
        m.rotation.z = Math.cos(panoramaBox.rotation.y * 3) * Math.PI / 4 - Math.PI / 2
      }
      group.add(m)
    }

    this.scene.add(group)
    this.panoramaGroup = group
  }

  async worldBlocksPanorama () {
    const version = '1.21.4'
    this.options.resourcesManager.currentConfig = { version }
    await this.options.resourcesManager.updateAssetsData({ })
    if (this.abortController.signal.aborted) return
    console.time('load panorama scene')
    const world = getSyncWorld(version)
    const PrismarineBlock = require('prismarine-block')
    const Block = PrismarineBlock(version)
    const fullBlocks = loadedData.blocksArray.filter(block => {
    // if (block.name.includes('leaves')) return false
      if (/* !block.name.includes('wool') &&  */!block.name.includes('stained_glass')/*  && !block.name.includes('terracotta') */) return false
      const b = Block.fromStateId(block.defaultState, 0)
      if (b.shapes?.length !== 1) return false
      const shape = b.shapes[0]
      return shape[0] === 0 && shape[1] === 0 && shape[2] === 0 && shape[3] === 1 && shape[4] === 1 && shape[5] === 1
    })
    const Z = -15
    const sizeX = 100
    const sizeY = 100
    for (let x = -sizeX; x < sizeX; x++) {
      for (let y = -sizeY; y < sizeY; y++) {
        const block = fullBlocks[Math.floor(Math.random() * fullBlocks.length)]
        world.setBlockStateId(new Vec3(x, y, Z), block.defaultState)
      }
    }
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0.5, sizeY / 2 + 0.5, 0.5)
    this.camera.rotation.set(0, 0, 0)
    const initPos = new Vec3(...this.camera.position.toArray())
    const worldView = new WorldDataEmitter(world, 2, initPos)
    // worldView.addWaitTime = 0
    if (this.abortController.signal.aborted) return

    this.worldRenderer = new WorldRendererThree(
      this.documentRenderer.renderer,
      this.options,
      {
        version,
        worldView,
        inWorldRenderingConfig: defaultWorldRendererConfig,
        playerState: new BasePlayerState(),
        rendererState: getDefaultRendererState()
      }
    )
    this.scene = this.worldRenderer.scene
    void worldView.init(initPos)

    await this.worldRenderer.waitForChunksToRender()
    if (this.abortController.signal.aborted) return
    // add small camera rotation to side on mouse move depending on absolute position of the cursor
    const { camera } = this
    const initX = camera.position.x
    const initY = camera.position.y
    let prevTwin: tweenJs.Tween<THREE.Vector3> | undefined
    document.body.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      const pos = new THREE.Vector2(e.clientX, e.clientY)
      const SCALE = 0.2
      /* -0.5 - 0.5 */
      const xRel = pos.x / window.innerWidth - 0.5
      const yRel = -(pos.y / window.innerHeight - 0.5)
      prevTwin?.stop()
      const to = {
        x: initX + (xRel * SCALE),
        y: initY + (yRel * SCALE)
      }
      prevTwin = new tweenJs.Tween(camera.position).to(to, 0) // todo use the number depending on diff // todo use the number depending on diff
      // prevTwin.easing(tweenJs.Easing.Exponential.InOut)
      prevTwin.start()
      camera.updateProjectionMatrix()
    }, {
      signal: this.abortController.signal
    })

    console.timeEnd('load panorama scene')
  }

  dispose () {
    this.scene.clear()
    this.worldRenderer?.destroy()
    this.abortController.abort()
  }
}
