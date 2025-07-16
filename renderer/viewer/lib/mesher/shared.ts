import { BlockType } from '../../../playground/shared'

export enum InstancingMode {
  None = 'none',
  ColorOnly = 'color_only',
  BlockInstancing = 'block_instancing',
  BlockInstancingOnly = 'block_instancing_only'
}

// only here for easier testing
export const defaultMesherConfig = {
  version: '',
  worldMaxY: 256,
  worldMinY: 0,
  enableLighting: true,
  skyLight: 15,
  smoothLighting: true,
  outputFormat: 'threeJs' as 'threeJs' | 'webgpu',
  // textureSize: 1024, // for testing
  debugModelVariant: undefined as undefined | number[],
  clipWorldBelowY: undefined as undefined | number,
  disableSignsMapsSupport: false,
}

export type CustomBlockModels = {
  [blockPosKey: string]: string // blockPosKey is "x,y,z" -> model name
}

export type MesherConfig = typeof defaultMesherConfig

export type InstancedBlockEntry = {
  stateId: number
  blockName: string
  positions: Array<{ x: number, y: number, z: number }>
}

export type InstancingMesherData = {
  blocks: {
    [stateId: number]: number // instance id
  }
}

export type MesherGeometryOutput = {
  sx: number,
  sy: number,
  sz: number,
  // resulting: float32array
  positions: any,
  normals: any,
  colors: any,
  uvs: any,
  t_positions?: number[],
  t_normals?: number[],
  t_colors?: number[],
  t_uvs?: number[],

  indices: Uint32Array | Uint16Array | number[],
  indicesCount: number,
  using32Array: boolean,
  tiles: Record<string, BlockType>,
  heads: Record<string, any>,
  signs: Record<string, any>,
  // isFull: boolean
  hadErrors: boolean
  blocksCount: number
  customBlockModels?: CustomBlockModels
  // New instanced blocks data
  instancedBlocks: Record<string, InstancedBlockEntry>
}

export interface MesherMainEvents {
  geometry: { type: 'geometry'; key: string; geometry: MesherGeometryOutput; workerIndex: number };
  sectionFinished: { type: 'sectionFinished'; key: string; workerIndex: number; processTime?: number };
  blockStateModelInfo: { type: 'blockStateModelInfo'; info: Record<string, BlockStateModelInfo> };
  heightmap: { type: 'heightmap'; key: string; heightmap: Uint8Array };
}

export type MesherMainEvent = MesherMainEvents[keyof MesherMainEvents]

export type HighestBlockInfo = { y: number, stateId: number | undefined, biomeId: number | undefined }

export type BlockStateModelInfo = {
  cacheKey: string
  issues: string[]
  modelNames: string[]
  conditions: string[]
}

export const getBlockAssetsCacheKey = (stateId: number, modelNameOverride?: string) => {
  return modelNameOverride ? `${stateId}:${modelNameOverride}` : String(stateId)
}
