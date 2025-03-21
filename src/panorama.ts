//@ts-check

import { join } from 'path'
import * as THREE from 'three'
import { EntityMesh } from 'renderer/viewer/lib/entity/EntityMesh'
import { WorldDataEmitter } from 'renderer/viewer'
import { Vec3 } from 'vec3'
import { getSyncWorld } from 'renderer/playground/shared'
import * as tweenJs from '@tweenjs/tween.js'
import { subscribeKey } from 'valtio/utils'
import { options } from './optionsStorage'
import { miscUiState } from './globalState'
import { loadMinecraftData } from './connect'

let panoramaCubeMap
let shouldDisplayPanorama = true

const panoramaFiles = [
  'panorama_3.png', // right (+x)
  'panorama_1.png', // left (-x)
  'panorama_4.png', // top (+y)
  'panorama_5.png', // bottom (-y)
  'panorama_0.png', // front (+z)
  'panorama_2.png', // back (-z)
]

let unloadPanoramaCallbacks = [] as Array<() => void>

// Menu panorama background
// TODO-low use abort controller
export async function addPanoramaCubeMap () {
  if (panoramaCubeMap || miscUiState.loadedDataVersion || options.disableAssets) return
  await new Promise(resolve => {
    setTimeout(resolve, 0) // wait for viewer to be initialized
  })
  viewer.camera.fov = 85
  if (!shouldDisplayPanorama) return
  if (process.env.SINGLE_FILE_BUILD_MODE) {
    void initDemoWorld()
    return
  }

  let time = 0
  viewer.camera.near = 0.05
  viewer.camera.updateProjectionMatrix()
  viewer.camera.position.set(0, 0, 0)
  viewer.camera.rotation.set(0, 0, 0)
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
      depthWrite: false
    }))
  }

  if (!shouldDisplayPanorama) return

  const panoramaBox = new THREE.Mesh(panorGeo, panorMaterials)

  panoramaBox.onBeforeRender = () => {
    time += 0.01
    panoramaBox.rotation.y = Math.PI + time * 0.01
    panoramaBox.rotation.z = Math.sin(-time * 0.001) * 0.001
  }

  const group = new THREE.Object3D()
  group.add(panoramaBox)

  // should be rewritten entirely
  for (let i = 0; i < 20; i++) {
    const m = new EntityMesh('1.16.4', 'squid', viewer.world).mesh
    m.position.set(Math.random() * 30 - 15, Math.random() * 20 - 10, Math.random() * 10 - 17)
    m.rotation.set(0, Math.PI + Math.random(), -Math.PI / 4, 'ZYX')
    const v = Math.random() * 0.01
    m.children[0].onBeforeRender = () => {
      m.rotation.y += v
      m.rotation.z = Math.cos(panoramaBox.rotation.y * 3) * Math.PI / 4 - Math.PI / 2
    }
    group.add(m)
  }

  viewer.scene.add(group)
  panoramaCubeMap = group
}

if (process.env.SINGLE_FILE_BUILD_MODE) {
  subscribeKey(miscUiState, 'fsReady', () => {
    if (miscUiState.fsReady) {
      // don't do it earlier to load fs and display menu faster
      void addPanoramaCubeMap()
    }
  })
} else {
  void addPanoramaCubeMap()
}

export function removePanorama () {
  for (const unloadPanoramaCallback of unloadPanoramaCallbacks) {
    unloadPanoramaCallback()
  }
  unloadPanoramaCallbacks = []
  viewer.camera.fov = options.fov
  shouldDisplayPanorama = false
  if (!panoramaCubeMap) return
  viewer.camera.near = 0.1
  viewer.camera.updateProjectionMatrix()
  viewer.scene.remove(panoramaCubeMap)
  panoramaCubeMap = null
}

const initDemoWorld = async () => {
  const abortController = new AbortController()
  unloadPanoramaCallbacks.push(() => {
    abortController.abort()
  })
  const version = '1.21.4'
  console.time(`load ${version} mc-data`)
  await loadMinecraftData(version, true)
  console.timeEnd(`load ${version} mc-data`)
  if (abortController.signal.aborted) return
  console.time('load scene')
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
  viewer.camera.updateProjectionMatrix()
  viewer.camera.position.set(0.5, sizeY / 2 + 0.5, 0.5)
  viewer.camera.rotation.set(0, 0, 0)
  const initPos = new Vec3(...viewer.camera.position.toArray())
  const worldView = new WorldDataEmitter(world, 2, initPos)
  // worldView.addWaitTime = 0
  await viewer.world.setVersion(version)
  if (abortController.signal.aborted) return
  viewer.connect(worldView)
  void worldView.init(initPos)
  await viewer.world.waitForChunksToRender()
  if (abortController.signal.aborted) return
  // add small camera rotation to side on mouse move depending on absolute position of the cursor
  const { camera } = viewer
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
    signal: abortController.signal
  })

  console.timeEnd('load scene')
}
