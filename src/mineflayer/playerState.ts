import { EventEmitter } from 'events'
import { Vec3 } from 'vec3'
import { BasePlayerState, IPlayerState, ItemSpecificContextProperties, MovementState, PlayerStateEvents } from 'renderer/viewer/lib/basePlayerState'
import { HandItemBlock } from 'renderer/viewer/lib/holdingBlock'
import TypedEmitter from 'typed-emitter'
import { ItemSelector } from 'mc-assets/dist/itemDefinitions'
import { proxy } from 'valtio'
import { gameAdditionalState } from '../globalState'

export class PlayerStateManager implements IPlayerState {
  disableStateUpdates = false
  private static instance: PlayerStateManager
  readonly events = new EventEmitter() as TypedEmitter<PlayerStateEvents>

  // Movement and physics state
  private lastVelocity = new Vec3(0, 0, 0)
  private movementState: MovementState = 'NOT_MOVING'
  private timeOffGround = 0
  private lastUpdateTime = performance.now()

  // Held item state
  private heldItem?: HandItemBlock
  private offHandItem?: HandItemBlock
  private itemUsageTicks = 0
  private isUsingItem = false
  private ready = false
  onlineMode = false
  get username () {
    return bot.player?.username ?? ''
  }

  reactive: IPlayerState['reactive'] = new BasePlayerState().reactive

  static getInstance (): PlayerStateManager {
    if (!this.instance) {
      this.instance = new PlayerStateManager()
    }
    return this.instance
  }

  constructor () {
    this.updateState = this.updateState.bind(this)
    customEvents.on('mineflayerBotCreated', () => {
      this.ready = false
      bot.on('inject_allowed', () => {
        if (this.ready) return
        this.ready = true
        this.botCreated()
      })
    })
  }

  private botCreated () {
    // Movement tracking
    bot.on('move', this.updateState)

    // Item tracking
    bot.on('heldItemChanged', () => {
      return this.updateHeldItem(false)
    })
    bot.inventory.on('updateSlot', (index) => {
      if (index === 45) this.updateHeldItem(true)
    })
    bot.on('physicsTick', () => {
      if (this.isUsingItem) this.itemUsageTicks++
    })

    // Initial held items setup
    this.updateHeldItem(false)
    this.updateHeldItem(true)

    bot.on('game', () => {
      this.reactive.gameMode = bot.game.gameMode
    })
    this.reactive.gameMode = bot.game?.gameMode
  }

  // #region Movement and Physics State
  private updateState () {
    if (!bot.player?.entity || this.disableStateUpdates) return

    const { velocity } = bot.player.entity
    const isOnGround = bot.entity.onGround
    const VELOCITY_THRESHOLD = 0.01
    const SPRINTING_VELOCITY = 0.15
    const OFF_GROUND_THRESHOLD = 0 // ms before switching to SNEAKING when off ground

    const now = performance.now()
    const deltaTime = now - this.lastUpdateTime
    this.lastUpdateTime = now

    this.lastVelocity = velocity

    // Update time off ground
    if (isOnGround) {
      this.timeOffGround = 0
    } else {
      this.timeOffGround += deltaTime
    }

    if (this.isSneaking() || this.isFlying() || (this.timeOffGround > OFF_GROUND_THRESHOLD)) {
      this.movementState = 'SNEAKING'
    } else if (Math.abs(velocity.x) > VELOCITY_THRESHOLD || Math.abs(velocity.z) > VELOCITY_THRESHOLD) {
      this.movementState = Math.abs(velocity.x) > SPRINTING_VELOCITY || Math.abs(velocity.z) > SPRINTING_VELOCITY
        ? 'SPRINTING'
        : 'WALKING'
    } else {
      this.movementState = 'NOT_MOVING'
    }
  }

  getMovementState (): MovementState {
    return this.movementState
  }

  getVelocity (): Vec3 {
    return this.lastVelocity
  }

  getEyeHeight (): number {
    return bot.controlState.sneak ? 1.27 : 1.62
  }

  isOnGround (): boolean {
    return bot?.entity?.onGround ?? true
  }

  isSneaking (): boolean {
    return gameAdditionalState.isSneaking
  }

  isFlying (): boolean {
    return gameAdditionalState.isFlying
  }

  isSprinting (): boolean {
    return gameAdditionalState.isSprinting
  }

  getPosition (): Vec3 {
    return bot.player?.entity.position ?? new Vec3(0, 0, 0)
  }
  // #endregion

  // #region Held Item State
  private updateHeldItem (isLeftHand: boolean) {
    const newItem = isLeftHand ? bot.inventory.slots[45] : bot.heldItem
    if (!newItem) {
      if (isLeftHand) {
        this.offHandItem = undefined
      } else {
        this.heldItem = undefined
      }
      this.events.emit('heldItemChanged', undefined, isLeftHand)
      return
    }

    const block = loadedData.blocksByName[newItem.name]
    const blockProperties = block ? new window.PrismarineBlock(block.id, 'void', newItem.metadata).getProperties() : {}
    const item: HandItemBlock = {
      name: newItem.name,
      properties: blockProperties,
      id: newItem.type,
      type: block ? 'block' : 'item',
      fullItem: newItem,
    }

    if (isLeftHand) {
      this.offHandItem = item
    } else {
      this.heldItem = item
    }
    this.events.emit('heldItemChanged', item, isLeftHand)
  }

  startUsingItem () {
    if (this.isUsingItem) return
    this.isUsingItem = true
    this.itemUsageTicks = 0
  }

  stopUsingItem () {
    this.isUsingItem = false
    this.itemUsageTicks = 0
  }

  getItemUsageTicks (): number {
    return this.itemUsageTicks
  }

  getHeldItem (isLeftHand = false): HandItemBlock | undefined {
    return isLeftHand ? this.offHandItem : this.heldItem
  }

  getItemSelector (specificProperties: ItemSpecificContextProperties, item?: import('prismarine-item').Item): ItemSelector['properties'] {
    return {
      ...specificProperties,
      'minecraft:date': new Date(),
      // "minecraft:context_dimension": bot.entityp,
      'minecraft:time': bot.time.timeOfDay / 24_000,
    }
  }
  // #endregion
}

export const playerState = PlayerStateManager.getInstance()
window.playerState = playerState
