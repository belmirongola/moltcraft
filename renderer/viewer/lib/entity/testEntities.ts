import { z } from 'zod'
import entities from './entities.json'

// Define Zod schemas matching the TypeScript interfaces
const ElemFaceSchema = z.object({
  dir: z.tuple([z.number(), z.number(), z.number()]),
  u0: z.tuple([z.number(), z.number(), z.number()]),
  v0: z.tuple([z.number(), z.number(), z.number()]),
  u1: z.tuple([z.number(), z.number(), z.number()]),
  v1: z.tuple([z.number(), z.number(), z.number()]),
  corners: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]))
})

const UVFaceSchema = z.object({
  uv: z.tuple([z.number(), z.number()])
})

const CubeFacesSchema = z.object({
  north: UVFaceSchema.optional(),
  south: UVFaceSchema.optional(),
  east: UVFaceSchema.optional(),
  west: UVFaceSchema.optional(),
  up: UVFaceSchema.optional(),
  down: UVFaceSchema.optional()
})

const JsonCubeSchema = z.object({
  origin: z.tuple([z.number(), z.number(), z.number()]),
  size: z.tuple([z.number(), z.number(), z.number()]),
  uv: z.union([
    z.tuple([z.number(), z.number()]),
    z.object({
      north: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional(),
      south: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional(),
      east: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional(),
      west: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional(),
      up: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional(),
      down: z.object({ uv: z.tuple([z.number(), z.number()]) }).optional()
    })
  ]).optional(),
  inflate: z.number().optional(),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional()
})

const JsonBoneSchema = z.object({
  name: z.string(),
  pivot: z.tuple([z.number(), z.number(), z.number()]).optional(),
  bind_pose_rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  parent: z.string().optional(),
  cubes: z.array(JsonCubeSchema).optional(),
  mirror: z.boolean().optional()
})

const JsonModelSchema = z.object({
  texturewidth: z.number().optional(),
  textureheight: z.number().optional(),
  bones: z.array(JsonBoneSchema)
})

const EntityGeometrySchema = z.record(JsonModelSchema)

const EntitiesSchema = z.record(z.object({
  geometry: EntityGeometrySchema,
  textures: z.record(z.string())
}))

// Validate entities.json against schema
let validatedEntities
try {
  validatedEntities = EntitiesSchema.parse(entities)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation errors:')
    for (const err of error.errors) {
      console.error(`- Path: ${err.path.join('.')}`)
      console.error(`  Error: ${err.message}`)
    }
  }
  throw error
}

export default validatedEntities
