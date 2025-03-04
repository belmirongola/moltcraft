import * as THREE from 'three'
import { EntityMesh } from '../lib/entity/EntityMesh'
import { DocumentRenderer } from './renderer'

const panoramaFiles = [
  'panorama_1.png', // WS
  'panorama_3.png', // ES
  'panorama_4.png', // Up
  'panorama_5.png', // Down
  'panorama_0.png', // NS
  'panorama_2.png' // SS
]

export class PanoramaRenderer {
  private readonly camera: THREE.PerspectiveCamera
  private readonly scene: THREE.Scene
  private panoramaGroup: THREE.Object3D | null = null
  private readonly documentRenderer: DocumentRenderer
  private time = 0

  constructor (documentRenderer: DocumentRenderer) {
    this.documentRenderer = documentRenderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.05, 1000)
    this.camera.position.set(0, 0, 0)
    this.camera.rotation.set(0, 0, 0)
  }

  async start () {
    const panorGeo = new THREE.BoxGeometry(1000, 1000, 1000)
    const loader = new THREE.TextureLoader()
    const panorMaterials = [] as THREE.MeshBasicMaterial[]

    for (const file of panoramaFiles) {
      panorMaterials.push(new THREE.MeshBasicMaterial({
        map: loader.load(`background/${file}`),
        transparent: true,
        side: THREE.DoubleSide
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
      const m = new EntityMesh('1.16.4', 'squid', this.documentRenderer.world).mesh
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

    // Override renderer's render method
    const originalRender = this.documentRenderer.render.bind(this.documentRenderer)
    this.documentRenderer.render = () => {
      if (this.panoramaGroup) {
        this.documentRenderer.renderer.render(this.scene, this.camera)
      } else {
        originalRender()
      }
    }
  }

  stop () {
    if (this.panoramaGroup) {
      this.scene.remove(this.panoramaGroup)
      this.panoramaGroup = null
    }
  }

  dispose () {
    this.stop()
    this.scene.clear()
  }
}
