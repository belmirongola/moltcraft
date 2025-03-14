import { proxy, subscribe } from 'valtio'
import { UserOverridesConfig } from 'contro-max/build/types/store'
import { subscribeKey } from 'valtio/utils'
import { CustomCommand } from './KeybindingsCustom'
import { AuthenticatedAccount } from './serversStorage'
import type { BaseServerInfo } from './AddServerOrConnect'

// when opening html file locally in browser, localStorage is shared between all ever opened html files, so we try to avoid conflicts
const localStoragePrefix = process.env?.SINGLE_FILE_BUILD ? 'minecraft-web-client:' : ''

export interface SavedProxiesData {
  proxies: string[]
  selected: string
}

export interface ServerHistoryEntry {
  ip: string
  version?: string
  numConnects: number
  lastConnected: number
}

export interface StoreServerItem extends BaseServerInfo {
  lastJoined?: number
  description?: string
  optionsOverride?: Record<string, any>
  autoLogin?: Record<string, string>
  numConnects?: number // Track number of connections
}

type StorageData = {
  customCommands: Record<string, CustomCommand> | undefined
  username: string | undefined
  keybindings: UserOverridesConfig | undefined
  options: any
  proxiesData: SavedProxiesData | undefined
  serversHistory: ServerHistoryEntry[]
  authenticatedAccounts: AuthenticatedAccount[]
  serversList: StoreServerItem[] | undefined
}

const oldKeysAliases: Partial<Record<keyof StorageData, string>> = {
  serversHistory: 'serverConnectionHistory',
}

const defaultStorageData: StorageData = {
  customCommands: undefined,
  username: undefined,
  keybindings: undefined,
  options: {},
  proxiesData: undefined,
  serversHistory: [],
  authenticatedAccounts: [],
  serversList: undefined,
}

export const setDefaultDataOnConfigLoad = () => {
  defaultStorageData.username = `mcrafter${Math.floor(Math.random() * 1000)}`
}

export const appStorage = proxy({ ...defaultStorageData })

// Restore data from localStorage
for (const key of Object.keys(defaultStorageData)) {
  const prefixedKey = `${localStoragePrefix}${key}`
  const aliasedKey = oldKeysAliases[key]
  const storedValue = localStorage.getItem(prefixedKey) ?? (aliasedKey ? localStorage.getItem(aliasedKey) : undefined)
  if (storedValue) {
    try {
      appStorage[key] = JSON.parse(storedValue)
    } catch (e) {
      console.error(`Failed to parse stored value for ${key}:`, e)
    }
  }
}

// Subscribe to changes and save to localStorage
for (const key of Object.keys(appStorage)) {
  // eslint-disable-next-line @typescript-eslint/no-loop-func
  subscribeKey(appStorage, key, () => {
    const prefixedKey = `${localStoragePrefix}${key}`
    const value = appStorage[key as keyof StorageData]
    if (value === undefined) {
      localStorage.removeItem(prefixedKey)
    } else {
      localStorage.setItem(prefixedKey, JSON.stringify(value))
    }
  })
}

export const getStoredValue = <T extends keyof StorageData> (name: T): StorageData[T] => {
  return appStorage[name]
}

export const setStoredValue = <T extends keyof StorageData> (name: T, value: StorageData[T]) => {
  appStorage[name] = value
}
