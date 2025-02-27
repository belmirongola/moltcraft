//@ts-check

import { proxy, ref, subscribe } from 'valtio'
import type { WorldWarp } from 'flying-squid/dist/lib/modules/warps'
import type { OptionsGroupType } from './optionsGuiScheme'
import { appQueryParams } from './appParams'
import { options, disabledSettings } from './optionsStorage'

// todo: refactor structure with support of hideNext=false

const notHideableModalsWithoutForce = new Set(['app-status'])

if (appQueryParams.lockConnect) {
  notHideableModalsWithoutForce.add('editServer')
}

type Modal = ({ elem?: HTMLElement & Record<string, any> } & { reactType: string })

type ContextMenuItem = { callback; label }

export const activeModalStack: Modal[] = proxy([])

export const insertActiveModalStack = (name: string, newModalStack = activeModalStacks[name]) => {
  hideModal(undefined, undefined, { restorePrevious: false, force: true })
  activeModalStack.splice(0, activeModalStack.length, ...newModalStack)
  const last = activeModalStack.at(-1)
  if (last) showModalInner(last)
}

export const activeModalStacks: Record<string, Modal[]> = {}

window.activeModalStack = activeModalStack

/**
 * @returns true if operation was successful
 */
const showModalInner = (modal: Modal) => {
  const cancel = modal.elem?.show?.()
  return true
}

export const showModal = (elem: /* (HTMLElement & Record<string, any>) |  */{ reactType: string }) => {
  const resolved = elem
  const curModal = activeModalStack.at(-1)
  if (/* elem === curModal?.elem ||  */(elem.reactType && elem.reactType === curModal?.reactType) || !showModalInner(resolved)) return
  activeModalStack.push(resolved)
}

/**
 *
 * @returns true if previous modal was restored
 */
export const hideModal = (modal = activeModalStack.at(-1), data: any = undefined, options: { force?: boolean; restorePrevious?: boolean } = {}) => {
  const { force = false, restorePrevious = true } = options
  if (!modal) return
  let cancel = notHideableModalsWithoutForce.has(modal.reactType) ? !force : undefined
  if (force) {
    cancel = undefined
  }

  if (!cancel) {
    const lastModal = activeModalStack.at(-1)
    for (let i = activeModalStack.length - 1; i >= 0; i--) {
      if (activeModalStack[i].reactType === modal.reactType) {
        activeModalStack.splice(i, 1)
        break
      }
    }
    const newModal = activeModalStack.at(-1)
    if (newModal && lastModal !== newModal && restorePrevious) {
      // would be great to ignore cancel I guess?
      showModalInner(newModal)
    }
    return true
  }
}

export const hideCurrentModal = (_data?, onHide?: () => void) => {
  if (hideModal(undefined, undefined)) {
    onHide?.()
  }
}

export const hideAllModals = () => {
  while (activeModalStack.length > 0) {
    if (!hideModal()) break
  }
  return activeModalStack.length === 0
}

export const openOptionsMenu = (group: OptionsGroupType) => {
  showModal({ reactType: `options-${group}` })
}

subscribe(activeModalStack, () => {
  document.body.style.setProperty('--has-modals-z', activeModalStack.length ? '-1' : null)
})

// ---

export const currentContextMenu = proxy({ items: [] as ContextMenuItem[] | null, x: 0, y: 0 })

export const showContextmenu = (items: ContextMenuItem[], { clientX, clientY }) => {
  Object.assign(currentContextMenu, {
    items,
    x: clientX,
    y: clientY,
  })
}

// ---

export type AppConfig = {
  // defaultHost?: string
  // defaultHostSave?: string
  defaultProxy?: string
  // defaultProxySave?: string
  // defaultVersion?: string
  peerJsServer?: string
  peerJsServerFallback?: string
  promoteServers?: Array<{ ip, description, version? }>
  mapsProvider?: string

  appParams?: Record<string, any> // query string params

  defaultSettings?: Record<string, any>
  forceSettings?: Record<string, boolean>
  // hideSettings?: Record<string, boolean>
  allowAutoConnect?: boolean
  pauseLinks?: Array<Array<Record<string, any>>>
}

export const miscUiState = proxy({
  currentDisplayQr: null as string | null,
  currentTouch: null as boolean | null,
  hasErrors: false,
  singleplayer: false,
  flyingSquid: false,
  wanOpened: false,
  wanOpening: false,
  /** wether game hud is shown (in playing state) */
  gameLoaded: false,
  showUI: true,
  loadedServerIndex: '',
  /** currently trying to load or loaded mc version, after all data is loaded */
  loadedDataVersion: null as string | null,
  appLoaded: false,
  singleplayerAvailable: false,
  usingGamepadInput: false,
  appConfig: null as AppConfig | null,
  displaySearchInput: false,
  displayFullmap: false
})

export const loadAppConfig = (appConfig: AppConfig) => {
  if (miscUiState.appConfig) {
    Object.assign(miscUiState.appConfig, appConfig)
  } else {
    miscUiState.appConfig = appConfig
  }

  if (appConfig.forceSettings) {
    for (const [key, value] of Object.entries(appConfig.forceSettings)) {
      if (value) {
        disabledSettings.value.delete(key)
      } else {
        disabledSettings.value.add(key)
      }
    }
  }
}

export const isGameActive = (foregroundCheck: boolean) => {
  if (foregroundCheck && activeModalStack.length) return false
  return miscUiState.gameLoaded
}

window.miscUiState = miscUiState

// state that is not possible to get via bot and in-game specific
export const gameAdditionalState = proxy({
  isFlying: false,
  isSprinting: false,
  isSneaking: false,
  isZooming: false,
  warps: [] as WorldWarp[],
  noConnection: false,
  poorConnection: false,
  viewerConnection: false,

  usingServerResourcePack: false,
})

window.gameAdditionalState = gameAdditionalState
