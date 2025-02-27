import { createMouse } from 'mineflayer-mouse'
import * as THREE from 'three'
import { Bot } from 'mineflayer'
import { Block } from 'prismarine-block'
import { Vec3 } from 'vec3'
import { LineMaterial } from 'three-stdlib'
import { subscribeKey } from 'valtio/utils'
import { disposeObject } from 'renderer/viewer/lib/threeJsUtils'
import { isGameActive, showModal } from '../../globalState'

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
import { isCypress } from '../../standaloneUtils'
import { playerState } from '../playerState'

function createDisplayManager (bot: Bot, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  // State
  const state = {
    blockBreakMesh: null as THREE.Mesh | null,
    breakTextures: [] as THREE.Texture[],
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

  // Update functions
  function updateLineMaterial () {
    const inCreative = bot.game.gameMode === 'creative'
    const pixelRatio = viewer.renderer.getPixelRatio()

    viewer.world.threejsCursorLineMaterial = new LineMaterial({
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
      // dashed: true,
      // dashSize: 5,
    })
  }

  function updateDisplay () {
    if (viewer.world.threejsCursorLineMaterial) {
      const { renderer } = viewer
      viewer.world.threejsCursorLineMaterial.resolution.set(renderer.domElement.width, renderer.domElement.height)
      viewer.world.threejsCursorLineMaterial.dashOffset = performance.now() / 750
    }
  }
  beforeRenderFrame.push(updateDisplay)

  // Update cursor line material on game mode change
  bot.on('game', updateLineMaterial)
  // Update material when highlight color setting changes
  subscribeKey(options, 'highlightBlockColor', updateLineMaterial)

  function updateBreakAnimation (block: Block | undefined, stage: number | null) {
    hideBreakAnimation()
    if (!state.blockBreakMesh) return // todo
    if (stage === null || !block) return

    const mergedShape = bot.mouse.getMergedCursorShape(block)
    if (!mergedShape) return
    const { position, width, height, depth } = bot.mouse.getDataFromShape(mergedShape)
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

  function updateCursorBlock (data?: { block: Block }) {
    if (!data?.block) {
      viewer.world.setHighlightCursorBlock(null)
      return
    }

    const { block } = data
    viewer.world.setHighlightCursorBlock(block.position, bot.mouse.getBlockCursorShapes(block).map(shape => {
      return bot.mouse.getDataFromShape(shape)
    }))
  }

  bot.on('highlightCursorBlock', updateCursorBlock)

  bot.on('blockBreakProgressStage', updateBreakAnimation)

  bot.on('end', () => {
    disposeObject(state.blockBreakMesh!, true)
    scene.remove(state.blockBreakMesh!)
    viewer.world.setHighlightCursorBlock(null)
  })
}

export default (bot: Bot) => {
  bot.loadPlugin(createMouse({}))

  domListeners(bot)
  createDisplayManager(bot, viewer.scene, viewer.renderer)

  otherListeners()
}

const otherListeners = () => {
  bot.on('startDigging', (block) => {
    customEvents.emit('digStart')
  })

  bot.on('goingToSleep', () => {
    showModal({ reactType: 'bed' })
  })

  bot.on('botArmSwingStart', (hand) => {
    viewer.world.changeHandSwingingState(true, hand === 'left')
  })

  bot.on('botArmSwingEnd', (hand) => {
    viewer.world.changeHandSwingingState(false, hand === 'left')
  })

  bot.on('startUsingItem', (item, slot, isOffhand, duration) => {
    customEvents.emit('activateItem', item, isOffhand ? 45 : bot.quickBarSlot, isOffhand)
    playerState.startUsingItem()
  })

  bot.on('stopUsingItem', () => {
    playerState.stopUsingItem()
  })
}

const domListeners = (bot: Bot) => {
  document.addEventListener('mousedown', (e) => {
    if (e.isTrusted && !document.pointerLockElement && !isCypress()) return
    if (!isGameActive(true)) return

    if (e.button === 0) {
      bot.leftClickStart()
    } else if (e.button === 2) {
      bot.rightClickStart()
    }
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      bot.leftClickEnd()
    } else if (e.button === 2) {
      bot.rightClickEnd()
    }
  })

  bot.mouse.beforeUpdateChecks = () => {
    if (!document.hasFocus()) {
      // deactive all buttons
      bot.mouse.buttons.fill(false)
    }
  }
}
