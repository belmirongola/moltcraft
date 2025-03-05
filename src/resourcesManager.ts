import { Item } from 'prismarine-item'
import { ItemSpecificContextProperties } from 'renderer/viewer/lib/basePlayerState'
import { getItemDefinition } from 'mc-assets/dist/itemDefinitions'
import { playerState } from './mineflayer/playerState'
import { GeneralInputItem, getItemMetadata } from './mineflayer/items'

export const getItemModelName = (item: GeneralInputItem, specificProps: ItemSpecificContextProperties) => {
  let itemModelName = item.name
  const { customModel } = getItemMetadata(item)
  if (customModel) {
    itemModelName = customModel
  }

  const itemSelector = playerState.getItemSelector({
    ...specificProps
  })
  const model = getItemDefinition(viewer.world.itemsDefinitionsStore, {
    name: itemModelName,
    version: viewer.world.texturesVersion!,
    properties: itemSelector
  })?.model ?? itemModelName
  return model
}
