import * as THREE from 'three'
import { LineMaterial, LineSegmentsGeometry, Wireframe } from 'three-stdlib'
import { Vec3 } from 'vec3'
import { subscribeKey } from 'valtio/utils'
import { Block } from 'prismarine-block'
import { WorldRendererThree } from '../worldrendererThree'
import destroyStage0 from '../../../../assets/destroy_stage_0.png'
import destroyStage1 from '../../../../assets/destroy_stage_1.png'
import destroyStage2 from '../../../../assets/destroy_stage_2.png'
import destroyStage3 from '../../../../assets/destroy_stage_3.png'
import destroyStage4 from '../../../../assets/destroy_stage_4.png'
import destroyStage5 from '../../../../assets/destroy_stage_5.png'
import destroyStage6 from '../../../../assets/destroy_stage_6.png'
import destroyStage7 from '../../../../assets/destroy_stage_7.png'
import destroyStage8 from '../../../../assets/destroy_stage_8.png'
import destroyStage9 from '../../../../assets/destroy_stage_9.png'

export class CursorBlock {
  cursorLineMaterial: LineMaterial
  interactionLines: null | { blockPos; mesh } = null
  prevColor
  blockBreakMesh: THREE.Mesh
  breakTextures: THREE.Texture[] = []

  constructor (public readonly worldRenderer: WorldRendererThree) {
    // Initialize break mesh and textures
    const loader = new THREE.TextureLoader()
    const destroyStagesImages = [
      destroyStage0, destroyStage1, destroyStage2, destroyStage3, destroyStage4,
      destroyStage5, destroyStage6, destroyStage7, destroyStage8, destroyStage9
    ]

    for (let i = 0; i < 10; i++) {
      const texture = loader.load(destroyStagesImages[i])
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      this.breakTextures.push(texture)
    }

    const breakMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.MultiplyBlending,
      alphaTest: 0.5,
    })
    this.blockBreakMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), breakMaterial)
    this.blockBreakMesh.visible = false
    this.blockBreakMesh.renderOrder = 999
    this.blockBreakMesh.name = 'blockBreakMesh'
    this.worldRenderer.scene.add(this.blockBreakMesh)

    subscribeKey(this.worldRenderer.playerState.reactive, 'gameMode', () => {
      this.updateLineMaterial()
    })

    this.updateLineMaterial()
  }

  // Update functions
  updateLineMaterial () {
    const inCreative = this.worldRenderer.displayOptions.playerState.reactive.gameMode === 'creative'
    const pixelRatio = this.worldRenderer.renderer.getPixelRatio()

    this.cursorLineMaterial = new LineMaterial({
      color: (() => {
        switch (this.worldRenderer.worldRendererConfig.highlightBlockColor) {
          case 'blue':
            return 0x40_80_ff
          case 'classic':
            return 0x00_00_00
          default:
            return inCreative ? 0x40_80_ff : 0x00_00_00
        }
      })(),
      linewidth: Math.max(pixelRatio * 0.7, 1) * 2,
      // dashed: true,
      // dashSize: 5,
    })
    this.prevColor = this.worldRenderer.worldRendererConfig.highlightBlockColor
  }

  updateBreakAnimation (block: Block | undefined, stage: number | null) {
    this.hideBreakAnimation()
    if (stage === null || !block) return

    const mergedShape = bot.mouse.getMergedCursorShape(block)
    if (!mergedShape) return
    const { position, width, height, depth } = bot.mouse.getDataFromShape(mergedShape)
    this.blockBreakMesh.scale.set(width * 1.001, height * 1.001, depth * 1.001)
    position.add(block.position)
    this.blockBreakMesh.position.set(position.x, position.y, position.z)
    this.blockBreakMesh.visible = true;

    (this.blockBreakMesh.material as THREE.MeshBasicMaterial).map = this.breakTextures[stage] ?? this.breakTextures.at(-1);
    (this.blockBreakMesh.material as THREE.MeshBasicMaterial).needsUpdate = true
  }

  hideBreakAnimation () {
    if (this.blockBreakMesh) {
      this.blockBreakMesh.visible = false
    }
  }

  updateDisplay () {
    if (this.cursorLineMaterial) {
      const { renderer } = this.worldRenderer
      this.cursorLineMaterial.resolution.set(renderer.domElement.width, renderer.domElement.height)
      this.cursorLineMaterial.dashOffset = performance.now() / 750
    }
  }

  setHighlightCursorBlock (blockPos: Vec3 | null, shapePositions?: Array<{ position: any; width: any; height: any; depth: any; }>): void {
    if (blockPos && this.interactionLines && blockPos.equals(this.interactionLines.blockPos)) {
      return
    }
    if (this.interactionLines !== null) {
      this.worldRenderer.scene.remove(this.interactionLines.mesh)
      this.interactionLines = null
    }
    if (blockPos === null) {
      return
    }

    const group = new THREE.Group()
    for (const { position, width, height, depth } of shapePositions ?? []) {
      const scale = [1.0001 * width, 1.0001 * height, 1.0001 * depth] as const
      const geometry = new THREE.BoxGeometry(...scale)
      const lines = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geometry))
      const wireframe = new Wireframe(lines, this.cursorLineMaterial)
      const pos = blockPos.plus(position)
      wireframe.position.set(pos.x, pos.y, pos.z)
      wireframe.computeLineDistances()
      group.add(wireframe)
    }
    this.worldRenderer.scene.add(group)
    this.interactionLines = { blockPos, mesh: group }
  }

  render () {
    if (this.prevColor !== this.worldRenderer.worldRendererConfig.highlightBlockColor) {
      this.updateLineMaterial()
    }
    this.updateDisplay()
  }
}
