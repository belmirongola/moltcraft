import { BlockType } from '../../../playground/shared'

// only here for easier testing
export const defaultMesherConfig = {
  version: '',
  enableLighting: true,
  skyLight: 15,
  smoothLighting: true,
  outputFormat: 'threeJs' as 'threeJs' | 'webgpu',
  textureSize: 1024, // for testing
  debugModelVariant: undefined as undefined | number[],
  clipWorldBelowY: undefined as undefined | number,
  disableSignsMapsSupport: false
}

export type CustomBlockModels = {
  [blockPosKey: string]: string // blockPosKey is "x,y,z" -> model name
}

export type MesherConfig = typeof defaultMesherConfig

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

  indices: number[],
  tiles: Record<string, BlockType>,
  heads: Record<string, any>,
  signs: Record<string, any>,
  // isFull: boolean
  highestBlocks: Map<string, HighestBlockInfo>
  hadErrors: boolean
  blocksCount: number
  customBlockModels?: CustomBlockModels
}

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
