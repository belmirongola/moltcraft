import { createMouse } from 'mineflayer-mouse'
import * as THREE from 'three'
import { Bot } from 'mineflayer'
import { Block } from 'prismarine-block'
import { Vec3 } from 'vec3'
import { LineMaterial } from 'three-stdlib'
import { subscribeKey } from 'valtio/utils'
import { showModal } from '../../globalState'

// wouldn't better to create atlas instead?
import destroyStage0 from '../../../assets/destroy_stage_0.png'
import destroyStage1 from '../../../assets/destroy_stage_1.png'
import destroyStage2 from '../../../assets/destroy_stage_2.png'
import destroyStage3 from '../../../assets/destroy_stage_3.png'
import destroyStage4 from '../../../assets/destroy_stage_4.png'
import destroyStage5 from '../../../assets/destroy_stage_5.png'
import destroyStage6 from '../../../assets/destroy_stage_6.png'
import destroyStage7 from '../../../assets/destroy_stage_7.png'
import destroyStage8 from '../../../assets/destroy_stage_8.png'
import destroyStage9 from '../../../assets/destroy_stage_9.png'
import { options } from '../../optionsStorage'

interface CursorBlockData {
  block: Block | null
  shapes: Array<{ position: Vec3, width: number, height: number, depth: number }>
}

function createDisplayManager (bot: Bot, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  // State
  const state = {
    blockBreakMesh: null as THREE.Mesh | null,
    breakTextures: [] as THREE.Texture[],
    cursorLineMaterial: null as LineMaterial | null
  }

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
    state.breakTextures.push(texture)
  }

  const breakMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.MultiplyBlending,
    alphaTest: 0.5,
  })
  state.blockBreakMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), breakMaterial)
  state.blockBreakMesh.visible = false
  state.blockBreakMesh.renderOrder = 999
  state.blockBreakMesh.name = 'blockBreakMesh'
  scene.add(state.blockBreakMesh)

  // Helper function to get shape data
  function getDataFromShape (shape: number[]) {
    const width = shape[3] - shape[0]
    const height = shape[4] - shape[1]
    const depth = shape[5] - shape[2]
    const centerX = (shape[3] + shape[0]) / 2
    const centerY = (shape[4] + shape[1]) / 2
    const centerZ = (shape[5] + shape[2]) / 2
    const position = new Vec3(centerX, centerY, centerZ)
    return { position, width, height, depth }
  }

  // Update functions
  function updateLineMaterial () {
    const inCreative = bot.game.gameMode === 'creative'
    const pixelRatio = renderer.getPixelRatio()

    state.cursorLineMaterial = new LineMaterial({
      color: (() => {
        switch (options.highlightBlockColor) {
          case 'blue':
            return 0x40_80_ff
          case 'classic':
            return 0x00_00_00
          default:
            return inCreative ? 0x40_80_ff : 0x00_00_00
        }
      })(),
      linewidth: Math.max(pixelRatio * 0.7, 1) * 2,
    })
  }

  function updateBreakAnimation (block: Block, stage: number | null) {
    if (!state.blockBreakMesh) return

    const shapes = [...block.shapes ?? [], ...block['interactionShapes'] ?? []]
    if (!shapes.length) return

    // Union of all shapes
    const breakShape = shapes.reduce((acc, cur) => {
      return [
        Math.min(acc[0], cur[0]),
        Math.min(acc[1], cur[1]),
        Math.min(acc[2], cur[2]),
        Math.max(acc[3], cur[3]),
        Math.max(acc[4], cur[4]),
        Math.max(acc[5], cur[5])
      ]
    })

    const { position, width, height, depth } = getDataFromShape(breakShape)
    state.blockBreakMesh.scale.set(width * 1.001, height * 1.001, depth * 1.001)
    position.add(block.position)
    state.blockBreakMesh.position.set(position.x, position.y, position.z)
    state.blockBreakMesh.visible = true

    //@ts-expect-error
    state.blockBreakMesh.material.map = state.breakTextures[stage] ?? state.breakTextures.at(-1)
    //@ts-expect-error
    state.blockBreakMesh.material.needsUpdate = true
  }

  function hideBreakAnimation () {
    if (state.blockBreakMesh) {
      state.blockBreakMesh.visible = false
    }
  }

  function updateDisplay () {
    if (state.cursorLineMaterial) {
      state.cursorLineMaterial.resolution.set(
        renderer.domElement.width,
        renderer.domElement.height
      )
      // state.cursorLineMaterial.dashOffset = performance.now() / 750
    }
  }
  beforeRenderFrame.push(updateDisplay)

  // Set up event listeners
  bot.on('highlightCursorBlock', (data?: CursorBlockData) => {
    if (!data) {
      // Handle cursor highlight update with null data

    }
    // Handle cursor highlight update with data
  })

  bot.on('blockBreakProgress', (block: Block, stage: number | null) => {
    updateBreakAnimation(block, stage)
  })

  bot.on('diggingCompleted', hideBreakAnimation)
  bot.on('diggingAborted', hideBreakAnimation)

  // Update cursor line material on game mode change
  bot.on('game', updateLineMaterial)
  // Update material when highlight color setting changes
  subscribeKey(options, 'highlightBlockColor', updateLineMaterial)
}

export default (bot: Bot) => {
  bot.loadPlugin(createMouse({}))

  domListeners(bot)
  createDisplayManager(bot, viewer.scene, viewer.renderer)

  bot.on('startDigging', (block) => {
    customEvents.emit('digStart')
  })

  bot.on('goingToSleep', () => {
    showModal({ reactType: 'bed' })
  })
}

const domListeners = (bot: Bot) => {
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      bot.rightClickStart()
    } else if (e.button === 1) {
      bot.leftClickStart()
    }
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      bot.rightClickEnd()
    } else if (e.button === 1) {
      bot.leftClickEnd()
    }
  })
}
