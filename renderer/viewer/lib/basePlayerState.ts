import { EventEmitter } from 'events'
import { Vec3 } from 'vec3'
import TypedEmitter from 'typed-emitter'
import { ItemSelector } from 'mc-assets/dist/itemDefinitions'
import { proxy } from 'valtio'
import { HandItemBlock } from './holdingBlock'

export type MovementState = 'NOT_MOVING' | 'WALKING' | 'SPRINTING' | 'SNEAKING'
export type ItemSpecificContextProperties = Partial<Pick<ItemSelector['properties'], 'minecraft:using_item' | 'minecraft:use_duration' | 'minecraft:use_cycle' | 'minecraft:display_context'>>


export type PlayerStateEvents = {
  heldItemChanged: (item: HandItemBlock | undefined, isLeftHand: boolean) => void
}

export interface IPlayerState {
  getEyeHeight(): number
  getMovementState(): MovementState
  getVelocity(): Vec3
  isOnGround(): boolean
  isSneaking(): boolean
  isFlying(): boolean
  isSprinting (): boolean
  getItemUsageTicks?(): number
  // isUsingItem?(): boolean
  getHeldItem?(isLeftHand: boolean): HandItemBlock | undefined
  username?: string
  onlineMode?: boolean

  events: TypedEmitter<PlayerStateEvents>

  reactive: {
    playerSkin: string | undefined
  }
}

export class BasePlayerState implements IPlayerState {
  getItemUsageTicks? (): number {
    throw new Error('Method not implemented.')
  }
  getHeldItem? (isLeftHand: boolean): HandItemBlock | undefined {
    throw new Error('Method not implemented.')
  }
  reactive = proxy({
    playerSkin: undefined
  })
  protected movementState: MovementState = 'NOT_MOVING'
  protected velocity = new Vec3(0, 0, 0)
  protected onGround = true
  protected sneaking = false
  protected flying = false
  protected sprinting = false
  readonly events = new EventEmitter() as TypedEmitter<PlayerStateEvents>

  getEyeHeight (): number {
    return 1.62
  }

  getMovementState (): MovementState {
    return this.movementState
  }

  getVelocity (): Vec3 {
    return this.velocity
  }

  isOnGround (): boolean {
    return this.onGround
  }

  isSneaking (): boolean {
    return this.sneaking
  }

  isFlying (): boolean {
    return this.flying
  }

  isSprinting (): boolean {
    return this.sprinting
  }

  // For testing purposes
  setState (state: Partial<{
    movementState: MovementState
    velocity: Vec3
    onGround: boolean
    sneaking: boolean
    flying: boolean
    sprinting: boolean
  }>) {
    Object.assign(this, state)
  }
}
