import { proxy, subscribe, useSnapshot } from 'valtio'
import { useEffect, useMemo } from 'react'
import { subscribeKey } from 'valtio/utils'
import { inGameError } from '../utils'
import { fsState } from '../loadSave'
import { gameAdditionalState, miscUiState } from '../globalState'
import { options } from '../optionsStorage'
import IndicatorEffects, { EffectType, defaultIndicatorsState } from './IndicatorEffects'
import { images } from './effectsImages'

export const state = proxy({
  indicators: {
  },
  effects: [] as EffectType[]
})

export const addEffect = (newEffect: Omit<EffectType, 'reduceTime' | 'removeEffect'>) => {
  const effectIndex = getEffectIndex(newEffect as EffectType)
  if (typeof effectIndex === 'number') {
    state.effects[effectIndex].time = newEffect.time
    state.effects[effectIndex].level = newEffect.level
  } else {
    const effect = { ...newEffect, reduceTime, removeEffect }
    state.effects.push(effect)
  }
}

const removeEffect = (image: string) => {
  for (const [index, effect] of (state.effects).entries()) {
    if (effect.image === image) {
      state.effects.splice(index, 1)
    }
  }
}

const reduceTime = (image: string) => {
  for (const [index, effect] of (state.effects).entries()) {
    if (effect.image === image) {
      effect.time -= 1
    }
  }
}

const getEffectIndex = (newEffect: EffectType) => {
  for (const [index, effect] of (state.effects).entries()) {
    if (effect.image === newEffect.image) {
      return index
    }
  }
  return null
}

export default () => {
  const stateIndicators = useSnapshot(state.indicators)
  const chunksLoading = !useSnapshot(appViewer.rendererState).world.allChunksLoaded
  const { mesherWork } = useSnapshot(appViewer.rendererState).world

  const { hasErrors } = useSnapshot(miscUiState)
  const { disabledUiParts } = useSnapshot(options)
  const { isReadonly, openReadOperations, openWriteOperations } = useSnapshot(fsState)
  const { noConnection, poorConnection } = useSnapshot(gameAdditionalState)
  const allIndicators: typeof defaultIndicatorsState = {
    readonlyFiles: isReadonly,
    writingFiles: openWriteOperations > 0,
    readingFiles: openReadOperations > 0,
    appHasErrors: hasErrors,
    connectionIssues: poorConnection ? 1 : noConnection ? 2 : 0,
    chunksLoading,
    // mesherWork,
    ...stateIndicators,
  }

  const effects = useSnapshot(state.effects)

  useMemo(() => {
    const effectsImages = Object.fromEntries(loadedData.effectsArray.map((effect) => {
      const nameKebab = effect.name.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).slice(1)
      return [effect.id, images[nameKebab]]
    }))
    bot.on('entityEffect', (entity, effect) => {
      if (entity.id !== bot.entity.id) return
      const image = effectsImages[effect.id] ?? null
      if (!image) {
        inGameError(`received unknown effect id ${effect.id}}`)
        return
      }
      const newEffect = {
        image,
        time: effect.duration / 20, // duration received in ticks
        level: effect.amplifier,
      }
      addEffect(newEffect)
    })
    bot.on('entityEffectEnd', (entity, effect) => {
      if (entity.id !== bot.entity.id) return
      const image = effectsImages[effect.id] ?? null
      if (!image) {
        inGameError(`received unknown effect id ${effect.id}}}`)
        return
      }
      removeEffect(image)
    })
  }, [])

  return <IndicatorEffects
    indicators={allIndicators}
    effects={effects}
  />
}
