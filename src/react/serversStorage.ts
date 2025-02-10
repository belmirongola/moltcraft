import { appQueryParams } from '../appParams'
import { miscUiState } from '../globalState'
import { BaseServerInfo } from './AddServerOrConnect'

const serversListQs = appQueryParams.serversList

export interface StoreServerItem extends BaseServerInfo {
  lastJoined?: number
  description?: string
  optionsOverride?: Record<string, any>
  autoLogin?: Record<string, string>
  numConnects?: number // Track number of connections
}
export interface AuthenticatedAccount {
  // type: 'microsoft'
  username: string
  cachedTokens?: {
    data: any
    expiresOn: number
  }
}
export interface ServerConnectionHistory {
  ip: string
  numConnects: number
  lastConnected: number
  version?: string
}

export function updateServerConnectionHistory (ip: string, version?: string) {
  try {
    const history: ServerConnectionHistory[] = JSON.parse(localStorage.getItem('serverConnectionHistory') || '[]')
    const existingServer = history.find(s => s.ip === ip)
    if (existingServer) {
      existingServer.numConnects++
      existingServer.lastConnected = Date.now()
      if (version) existingServer.version = version
    } else {
      history.push({
        ip,
        numConnects: 1,
        lastConnected: Date.now(),
        version
      })
    }
    localStorage.setItem('serverConnectionHistory', JSON.stringify(history))
  } catch (err) {
    console.error('Failed to update server connection history:', err)
  }
}
export const updateLoadedServerData = (callback: (data: StoreServerItem) => StoreServerItem, index = miscUiState.loadedServerIndex) => {
  if (!index) index = miscUiState.loadedServerIndex
  if (!index) return
  // function assumes component is not mounted to avoid sync issues after save
  const servers = getInitialServersList()
  const server = servers[index]
  servers[index] = callback(server)
  setNewServersList(servers)
}
export const setNewServersList = (serversList: StoreServerItem[], force = false) => {
  if (serversListQs && !force) return
  localStorage['serversList'] = JSON.stringify(serversList)

  // cleanup legacy
  localStorage.removeItem('serverHistory')
  localStorage.removeItem('server')
  localStorage.removeItem('password')
  localStorage.removeItem('version')
}
export const getInitialServersList = () => {
  if (localStorage['serversList']) return JSON.parse(localStorage['serversList']) as StoreServerItem[]

  const servers = [] as StoreServerItem[]

  const legacyServersList = localStorage['serverHistory'] ? JSON.parse(localStorage['serverHistory']) as string[] : null
  if (legacyServersList) {
    for (const server of legacyServersList) {
      if (!server || localStorage['server'] === server) continue
      servers.push({ ip: server, lastJoined: Date.now() })
    }
  }

  if (localStorage['server']) {
    const legacyLastJoinedServer: StoreServerItem = {
      ip: localStorage['server'],
      versionOverride: localStorage['version'],
      lastJoined: Date.now()
    }
    servers.push(legacyLastJoinedServer)
  }

  if (servers.length === 0) { // server list is empty, let's suggest some
    for (const server of miscUiState.appConfig?.promoteServers ?? []) {
      servers.push({
        ip: server.ip,
        description: server.description,
        versionOverride: server.version,
      })
    }
  }

  return servers
}
export const updateAuthenticatedAccountData = (callback: (data: AuthenticatedAccount[]) => AuthenticatedAccount[]) => {
  const accounts = JSON.parse(localStorage['authenticatedAccounts'] || '[]') as AuthenticatedAccount[]
  const newAccounts = callback(accounts)
  localStorage['authenticatedAccounts'] = JSON.stringify(newAccounts)
}

export function getServerConnectionHistory (): ServerConnectionHistory[] {
  try {
    return JSON.parse(localStorage.getItem('serverConnectionHistory') || '[]')
  } catch {
    return []
  }
}
