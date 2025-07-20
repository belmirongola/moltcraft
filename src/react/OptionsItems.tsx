import { useSnapshot } from 'valtio'
import { noCase } from 'change-case'
import { titleCase } from 'title-case'
import { useMemo } from 'react'
import { disabledSettings, options, qsOptions } from '../optionsStorage'
import { hideAllModals, miscUiState } from '../globalState'
import { reloadChunksAction } from '../controls'
import Button from './Button'
import Slider from './Slider'
import Screen from './Screen'
import { showOptionsModal } from './SelectOption'
import PixelartIcon, { pixelartIcons } from './PixelartIcon'
import { reconnectReload } from './AppStatusProvider'

type GeneralItem<T extends string | number | boolean> = {
  id?: string
  text?: string,
  disabledReason?: string,
  disabledDuringGame?: boolean
  tooltip?: string
  // description?: string
  enableWarning?: string
  requiresRestart?: boolean
  requiresChunksReload?: boolean
  values?: Array<T | [T, string]>
  disableIf?: [option: keyof typeof options, value: any]
}

export type OptionMeta<T = any> = GeneralItem<T & string> & ({
  type: 'toggle',
} | {
  type: 'slider'
  min?: number,
  max?: number,
  valueText?: (value: number) => string,
  unit?: string,
  delayApply?: boolean,
} | {
  type: 'element'
  render: () => React.ReactNode,
})

// todo not reactive
const isLocked = (item: GeneralItem<any>) => {
  return disabledSettings.value.has(item.id!)
}

const useCommonComponentsProps = (item: OptionMeta) => {
  let disabledBecauseOfSetting = false

  if (item.disableIf) {
    // okay to use hook conditionally as disableIf must be a constant
    const disableIfSetting = useSnapshot(options)[item.disableIf[0]]
    disabledBecauseOfSetting = disableIfSetting === item.disableIf[1]
  }

  return {
    disabledBecauseOfSetting
  }
}

const ignoreReloadWarningsCache = new Set<string>()

export const OptionButton = ({ item, onClick, valueText, cacheKey }: {
  item: Extract<OptionMeta, { type: 'toggle' }>,
  onClick?: () => void,
  valueText?: string,
  cacheKey?: string,
}) => {
  const { disabledBecauseOfSetting } = useCommonComponentsProps(item)

  const optionValue = useSnapshot(options)[item.id!]

  const valuesTitlesMap = useMemo(() => {
    if (!item.values) {
      return {
        // true: <span style={{ color: 'lime' }}>ON</span>,
        // false: <span style={{ color: 'red' }}>OFF</span>,
        true: 'ON',
        false: 'OFF',
      }
    }
    return Object.fromEntries(item.values.map((value) => {
      if (typeof value === 'string') {
        return [value, titleCase(noCase(value))]
      } else {
        return [value[0], value[1]]
      }
    }))
  }, [item.values])

  let { disabledReason } = item
  if (disabledBecauseOfSetting) disabledReason = `Disabled because ${item.disableIf![0]} is ${item.disableIf![1]}`

  return <Button
    data-setting={item.id}
    label={`${translate(item.text)}: ${translate(valueText ?? valuesTitlesMap[optionValue])}`}
    onClick={async (event) => {
      if (disabledReason) {
        await showOptionsModal(`${translate('The option is not available')}: ${disabledReason}`, [])
        return
      }
      if (item.enableWarning && !options[item.id!]) {
        const result = await showOptionsModal(item.enableWarning, ['Enable'])
        if (!result) return
      }
      onClick?.()
      if (item.id) {
        const { values } = item
        if (values) {
          const getOptionValue = (arrItem) => {
            if (typeof arrItem === 'string') {
              return arrItem
            } else {
              return arrItem[0]
            }
          }
          const currentIndex = values.findIndex((value) => {
            return getOptionValue(value) === optionValue
          })
          if (currentIndex === -1) {
            options[item.id] = getOptionValue(values[0])
          } else {
            const nextIndex = event.shiftKey
              ? (currentIndex - 1 + values.length) % values.length
              : (currentIndex + 1) % values.length
            options[item.id] = getOptionValue(values[nextIndex])
          }
        } else {
          options[item.id] = !options[item.id]
        }
      }

      const toCacheKey = cacheKey ?? item.id ?? ''
      if (toCacheKey && !ignoreReloadWarningsCache.has(toCacheKey)) {
        ignoreReloadWarningsCache.add(toCacheKey)

        if (item.requiresRestart) {
          const result = await showOptionsModal(translate('The option requires a restart to take effect'), ['Restart', 'I will do it later'], {
            cancel: false,
          })
          if (result) {
            reconnectReload()
          }
        }
        if (item.requiresChunksReload) {
          const result = await showOptionsModal(translate('The option requires a chunks reload to take effect'), ['Reload', 'I will do it later'], {
            cancel: false,
          })
          if (result) {
            reloadChunksAction()
          }
        }
      }
    }}
    title={disabledReason ? `${disabledReason} | ${item.tooltip}` : item.tooltip}
    disabled={disabledBecauseOfSetting || !!item.disabledReason || isLocked(item)}
    style={{
      width: 150,
    }}
  />
}

export const OptionSlider = ({ item }: { item: Extract<OptionMeta, { type: 'slider' }> }) => {
  const { disabledBecauseOfSetting } = useCommonComponentsProps(item)

  const optionValue = useSnapshot(options)[item.id!]

  const valueDisplay = useMemo(() => {
    if (item.valueText) return item.valueText(optionValue)
    return undefined // default display
  }, [optionValue])

  return (
    <Slider
      label={item.text!}
      value={options[item.id!]}
      data-setting={item.id}
      disabledReason={isLocked(item) ? 'qs' : disabledBecauseOfSetting ? `Disabled because ${item.disableIf![0]} is ${item.disableIf![1]}` : item.disabledReason}
      min={item.min}
      max={item.max}
      unit={item.unit}
      valueDisplay={valueDisplay}
      updateOnDragEnd={item.delayApply}
      updateValue={(value) => {
        options[item.id!] = value
      }}
    />
  )
}

const OptionElement = ({ item }: { item: Extract<OptionMeta, { type: 'element' }> }) => {
  return item.render()
}

const RenderOption = ({ item }: { item: OptionMeta }) => {
  const { gameLoaded } = useSnapshot(miscUiState)
  if (item.id) {
    item.text ??= titleCase(noCase(item.id))
  }
  if (item.disabledDuringGame && gameLoaded) {
    item.disabledReason = 'Cannot be changed during game'
  }

  let baseElement = null as React.ReactNode | null
  if (item.type === 'toggle') baseElement = <OptionButton item={item} />
  if (item.type === 'slider') baseElement = <OptionSlider item={item} />
  if (item.type === 'element') baseElement = <OptionElement item={item} />
  return baseElement
  // if (!item.description && item.type === 'element') return baseElement

  // return <div>
  //   {baseElement}
  //   {item.description && <div style={{ fontSize: 9, color: 'gray' }}>{item.description}</div>}
  // </div>
}

interface Props {
  readonly items: OptionMeta[]
  title: string
  backButtonAction?: () => void
}

export default ({ items, title, backButtonAction }: Props) => {

  return <Screen
    title={title}
  >
    <div className='screen-items'>
      <div style={{ position: 'fixed', marginLeft: '-30px', display: 'flex', flexDirection: 'column', gap: 1, }}>
        <Button icon={pixelartIcons['close']} onClick={hideAllModals} style={{ color: '#ff5d5d', }} />
        <Button icon={pixelartIcons['chevron-left']} onClick={backButtonAction} style={{ color: 'yellow', }} />
      </div>

      {items.map((element, i) => {
        // make sure its unique!
        return <RenderOption key={element.id ?? `${title}-${i}`} item={element} />
      })}
    </div>
    {backButtonAction && <Button onClick={() => backButtonAction()}>Back</Button>}
  </Screen>
}
