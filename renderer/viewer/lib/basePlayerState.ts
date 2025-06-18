import { ItemSelector } from 'mc-assets/dist/itemDefinitions'
import { GameMode } from 'mineflayer'
import { proxy } from 'valtio'
import type { HandItemBlock } from '../three/holdingBlock'

export type MovementState = 'NOT_MOVING' | 'WALKING' | 'SPRINTING' | 'SNEAKING'
export type ItemSpecificContextProperties = Partial<Pick<ItemSelector['properties'], 'minecraft:using_item' | 'minecraft:use_duration' | 'minecraft:use_cycle' | 'minecraft:display_context'>>


export type BlockShape = { position: any; width: any; height: any; depth: any; }
export type BlocksShapes = BlockShape[]

// edit src/mineflayer/playerState.ts for implementation of player state from mineflayer
export const getInitialPlayerState = () => proxy({
  playerSkin: undefined as string | undefined,
  inWater: false,
  waterBreathing: false,
  backgroundColor: [0, 0, 0] as [number, number, number],
  ambientLight: 0,
  directionalLight: 0,
  eyeHeight: 0,
  gameMode: undefined as GameMode | undefined,
  lookingAtBlock: undefined as {
    x: number
    y: number
    z: number
    face?: number
    shapes: BlocksShapes
  } | undefined,
  diggingBlock: undefined as {
    x: number
    y: number
    z: number
    stage: number
    face?: number
    mergedShape: BlockShape | undefined
  } | undefined,
  movementState: 'NOT_MOVING' as MovementState,
  onGround: true,
  sneaking: false,
  flying: false,
  sprinting: false,
  itemUsageTicks: 0,
  username: '',
  onlineMode: false,
  lightingDisabled: false,
  shouldHideHand: false,
  heldItemMain: undefined as HandItemBlock | undefined,
  heldItemOff: undefined as HandItemBlock | undefined,
})

export const getInitialPlayerStateRenderer = () => ({
  reactive: getInitialPlayerState()
})

export type PlayerStateReactive = ReturnType<typeof getInitialPlayerState>

export interface PlayerStateRenderer {
  reactive: PlayerStateReactive
}

export const getItemSelector = (playerState: PlayerStateRenderer, specificProperties: ItemSpecificContextProperties, item?: import('prismarine-item').Item) => {
  return {
    ...specificProperties,
    'minecraft:date': new Date(),
    // "minecraft:context_dimension": bot.entityp,
    // 'minecraft:time': bot.time.timeOfDay / 24_000,
  }
}
