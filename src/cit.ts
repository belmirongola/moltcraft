import { join } from 'path'
import fs from 'fs'
import { getLoadedImage } from './resourcePack'

export type CitRule = {
  type: 'item'
  items: string[]
  texture?: string
  model?: string
  nbt?: Record<string, string>
  damage?: number
  weight?: number
  textureContent?: HTMLImageElement
}

export type CitRules = CitRule[]

const parsePropertiesFile = async (filePath: string, fileContent: string): Promise<CitRule | null> => {
  const lines = fileContent.split('\n')
  const rule: Partial<CitRule> = {
    weight: 1
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    const [key, ...valueParts] = trimmedLine.split('=')
    const value = valueParts.join('=').trim()

    switch (key.trim()) {
      case 'type':
        if (value !== 'item') return null // Skip non-item rules
        rule.type = value
        break
      case 'items':
        rule.items = value.split(' ').map(item => item.trim()).filter(Boolean)
        break
      case 'texture':
        rule.texture = join(filePath, '..', value)
        break
      case 'model':
        rule.model = join(filePath, '..', value)
        break
      case 'damage':
        rule.damage = parseInt(value)
        break
      case 'weight':
        rule.weight = parseInt(value)
        break
      default:
        if (key.trim().startsWith('nbt.')) {
          rule.nbt ??= {}
          rule.nbt[key.trim().slice(4)] = value
        }
        break
    }
  }

  if (!rule.type || !rule.items?.length) return null

  return rule as CitRule
}

export const loadCitRules = async (basePath: string): Promise<CitRules> => {
  const rules: CitRules = []
  const citPath = join(basePath, 'assets/minecraft/optifine/cit')

  try {
    const processDirectory = async (dirPath: string) => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)

        if (entry.isDirectory()) {
          await processDirectory(fullPath)
        } else if (entry.name.endsWith('.properties')) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf8')
            const rule = await parsePropertiesFile(fullPath, content)
            if (rule) {
              if (rule.texture) {
                try {
                  const textureContent = await getLoadedImage(rule.texture)
                  rule.textureContent = textureContent
                } catch (err) {
                  console.error('Failed to load CIT texture:', rule.texture, err)
                }
              }
              rules.push(rule)
            }
          } catch (err) {
            console.error('Failed to parse CIT properties file:', fullPath, err)
          }
        }
      }
    }

    if (await fs.promises.stat(citPath).catch(() => null)) {
      await processDirectory(citPath)
    }
  } catch (err) {
    console.error('Failed to load CIT rules:', err)
  }

  return rules
}

export const matchCitRule = (item: { name: string, nbt?: any, durabilityUsed?: number }, rules: CitRules): CitRule | undefined => {
  const matchingRules = rules.filter(rule => {
    // Check item name match
    if (!rule.items.includes(item.name)) return false

    // Check damage if specified
    if (rule.damage !== undefined) {
      if (item.durabilityUsed !== rule.damage) return false
    }

    // Check NBT if specified
    if (rule.nbt) {
      for (const [path, value] of Object.entries(rule.nbt)) {
        const itemValue = path.split('.').reduce((obj, key) => obj?.[key], item.nbt)
        if (itemValue !== value) return false
      }
    }

    return true
  })

  // Return the highest weight matching rule
  return matchingRules.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0]
}
