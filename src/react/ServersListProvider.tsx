import { useEffect, useMemo, useState } from 'react'
import { useUtilsEffect } from '@zardoy/react-util'
import { useSnapshot } from 'valtio'
import { ConnectOptions } from '../connect'
import { activeModalStack, hideCurrentModal, miscUiState, showModal } from '../globalState'
import supportedVersions from '../supportedVersions.mjs'
import { appQueryParams } from '../appParams'
import { fetchServerStatus, isServerValid } from '../api/mcStatusApi'
import { getServerInfo } from '../mineflayer/mc-protocol'
import { parseServerAddress } from '../parseServerAddress'
import ServersList from './ServersList'
import AddServerOrConnect, { BaseServerInfo } from './AddServerOrConnect'
import { useDidUpdateEffect } from './utils'
import { useIsModalActive } from './utilsApp'
import { showOptionsModal } from './SelectOption'
import { useCopyKeybinding } from './simpleHooks'
import { AuthenticatedAccount, getInitialServersList, getServerConnectionHistory, setNewServersList, StoreServerItem } from './serversStorage'

type AdditionalDisplayData = {
  formattedText: string
  textNameRight: string
  icon?: string
  offline?: boolean
}

const serversListQs = appQueryParams.serversList
const proxyQs = appQueryParams.proxy

const getInitialProxies = () => {
  const proxies = [] as string[]
  if (miscUiState.appConfig?.defaultProxy) {
    proxies.push(miscUiState.appConfig.defaultProxy)
  }
  if (localStorage['proxy']) {
    proxies.push(localStorage['proxy'])
    localStorage.removeItem('proxy')
  }
  return proxies
}

// todo move to base
const normalizeIp = (ip: string) => ip.replace(/https?:\/\//, '').replace(/\/(:|$)/, '')

const FETCH_DELAY = 100 // ms between each request
const MAX_CONCURRENT_REQUESTS = 10

const Inner = ({ hidden, customServersList }: { hidden?: boolean, customServersList?: string[] }) => {
  const [proxies, setProxies] = useState<readonly string[]>(localStorage['proxies'] ? JSON.parse(localStorage['proxies']) : getInitialProxies())
  const [selectedProxy, setSelectedProxy] = useState(proxyQs ?? localStorage.getItem('selectedProxy') ?? proxies?.[0] ?? '')
  const [serverEditScreen, setServerEditScreen] = useState<StoreServerItem | true | null>(null) // true for add
  const [defaultUsername, _setDefaultUsername] = useState(localStorage['username'] ?? (`mcrafter${Math.floor(Math.random() * 1000)}`))
  const [authenticatedAccounts, _setAuthenticatedAccounts] = useState<AuthenticatedAccount[]>(JSON.parse(localStorage['authenticatedAccounts'] || '[]'))
  const [quickConnectIp, setQuickConnectIp] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const setAuthenticatedAccounts = (newState: typeof authenticatedAccounts) => {
    _setAuthenticatedAccounts(newState)
    localStorage.setItem('authenticatedAccounts', JSON.stringify(newState))
  }

  const setDefaultUsername = (newState: typeof defaultUsername) => {
    _setDefaultUsername(newState)
    localStorage.setItem('username', newState)
  }

  const saveNewProxy = () => {
    if (!selectedProxy || proxyQs) return
    localStorage.setItem('selectedProxy', selectedProxy)
  }

  useEffect(() => {
    if (proxies.length) {
      localStorage.setItem('proxies', JSON.stringify(proxies))
    }
    saveNewProxy()
  }, [proxies])

  const [serversList, setServersList] = useState<StoreServerItem[]>(() => (customServersList ? [] : getInitialServersList()))
  const [additionalData, setAdditionalData] = useState<Record<string, AdditionalDisplayData>>({})

  useEffect(() => {
    if (customServersList) {
      setServersList(customServersList.map(row => {
        const [ip, name] = row.split(' ')
        const [_ip, _port, version] = ip.split(':')
        return {
          ip,
          versionOverride: version,
          name,
        }
      }))
    }
  }, [customServersList])

  useDidUpdateEffect(() => {
    // save data only on user changes
    setNewServersList(serversList)
  }, [serversList])

  // by lastJoined
  const serversListSorted = useMemo(() => {
    return serversList.map((server, index) => ({ ...server, index })).sort((a, b) => (b.lastJoined ?? 0) - (a.lastJoined ?? 0))
  }, [serversList])

  const isEditScreenModal = useIsModalActive('editServer')

  useUtilsEffect(({ signal }) => {
    if (isEditScreenModal) return
    const update = async () => {
      const queue = serversListSorted
        .map(server => {
          if (!isServerValid(server.ip) || signal.aborted) return null

          return server
        })
        .filter(x => x !== null)

      const activeRequests = new Set<Promise<void>>()

      let lastRequestStart = 0
      for (const server of queue) {
        // Wait if at concurrency limit
        if (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
          // eslint-disable-next-line no-await-in-loop
          await Promise.race(activeRequests)
        }

        // Create and track new request
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const request = new Promise<void>(resolve => {
          setTimeout(async () => {
            try {
              lastRequestStart = Date.now()
              if (signal.aborted) return
              const isWebSocket = server.ip.startsWith('ws://') || server.ip.startsWith('wss://')
              let data
              if (isWebSocket) {
                const pingResult = await getServerInfo(server.ip, undefined, undefined, true)
                data = {
                  formattedText: `${pingResult.version} server with a direct websocket connection`,
                  textNameRight: `ws ${pingResult.latency}ms`,
                  offline: false
                }
              } else {
                data = await fetchServerStatus(server.ip/* , signal */) // DONT ADD SIGNAL IT WILL CRUSH JS RUNTIME
              }
              if (data) {
                setAdditionalData(old => ({
                  ...old,
                  [server.ip]: data
                }))
              }
            } catch (err) {
              console.warn('Failed to fetch server status', err)
            } finally {
              activeRequests.delete(request)
              resolve()
            }
          }, lastRequestStart ? Math.max(0, FETCH_DELAY - (Date.now() - lastRequestStart)) : 0)
        })

        activeRequests.add(request)
      }

      await Promise.all(activeRequests)
    }

    void update()
  }, [serversListSorted, isEditScreenModal])

  useDidUpdateEffect(() => {
    if (serverEditScreen && !isEditScreenModal) {
      showModal({ reactType: 'editServer' })
    }
    if (!serverEditScreen && isEditScreenModal) {
      hideCurrentModal()
    }
  }, [serverEditScreen])

  useDidUpdateEffect(() => {
    if (!isEditScreenModal) {
      setServerEditScreen(null)
    }
  }, [isEditScreenModal])

  useCopyKeybinding(() => {
    const item = serversList[selectedIndex]
    if (!item) return
    let str = `${item.ip}`
    if (item.versionOverride) {
      str += `:${item.versionOverride}`
    }
    return str
  })

  const editModalJsx = isEditScreenModal ? <AddServerOrConnect
    allowAutoConnect={miscUiState.appConfig?.allowAutoConnect}
    placeholders={{
      proxyOverride: selectedProxy,
      usernameOverride: defaultUsername,
    }}
    parseQs={!serverEditScreen}
    onBack={() => {
      hideCurrentModal()
    }}
    onConfirm={(info) => {
      if (!serverEditScreen) return
      if (serverEditScreen === true) {
        const server: StoreServerItem = { ...info, lastJoined: Date.now() } // so it appears first
        setServersList(old => [...old, server])
      } else {
        const index = serversList.indexOf(serverEditScreen)
        const { lastJoined } = serversList[index]
        serversList[index] = { ...info, lastJoined }
        setServersList([...serversList])
      }
      setServerEditScreen(null)
    }}
    accounts={authenticatedAccounts.map(a => a.username)}
    initialData={!serverEditScreen || serverEditScreen === true ? {
      ip: quickConnectIp
    } : serverEditScreen}
    onQsConnect={(info) => {
      const connectOptions: ConnectOptions = {
        username: info.usernameOverride || defaultUsername,
        server: normalizeIp(info.ip),
        proxy: info.proxyOverride || selectedProxy,
        botVersion: info.versionOverride,
        ignoreQs: true,
      }
      dispatchEvent(new CustomEvent('connect', { detail: connectOptions }))
    }}
    versions={supportedVersions}
  /> : null

  const serversListJsx = <ServersList
    joinServer={(overridesOrIp, { shouldSave }) => {
      let overrides: BaseServerInfo
      if (typeof overridesOrIp === 'string') {
        let msAuth = false
        const parts = overridesOrIp.split(':')
        if (parts.at(-1) === 'ms') {
          msAuth = true
          parts.pop()
        }
        const parsed = parseServerAddress(parts.join(':'))
        overrides = {
          ip: parsed.host,
          versionOverride: parsed.version,
          authenticatedAccountOverride: msAuth ? true : undefined, // todo popup selector
        }
      } else {
        overrides = overridesOrIp
      }

      const indexOrIp = overrides.ip
      let ip = indexOrIp
      let server: StoreServerItem | undefined
      if (shouldSave === undefined) {
        // hack: inner component doesn't know of overrides for existing servers
        server = serversListSorted.find(s => s.index.toString() === indexOrIp)!
        ip = server.ip
        overrides = server
      }

      const lastJoinedUsername = serversListSorted.find(s => s.usernameOverride)?.usernameOverride
      let username = overrides.usernameOverride || defaultUsername
      if (!username) {
        username = prompt('Username', lastJoinedUsername || '')
        if (!username) return
        setDefaultUsername(username)
      }
      let authenticatedAccount: AuthenticatedAccount | true | undefined
      if (overrides.authenticatedAccountOverride) {
        if (overrides.authenticatedAccountOverride === true) {
          authenticatedAccount = true
        } else {
          authenticatedAccount = authenticatedAccounts.find(a => a.username === overrides.authenticatedAccountOverride) ?? true
        }
      }
      const options = {
        username,
        server: normalizeIp(ip),
        proxy: overrides.proxyOverride || selectedProxy,
        botVersion: overrides.versionOverride ?? /* legacy */ overrides['version'],
        ignoreQs: true,
        autoLoginPassword: server?.autoLogin?.[username],
        authenticatedAccount,
        saveServerToHistory: shouldSave,
        onSuccessfulPlay () {
          if (shouldSave && !serversList.some(s => s.ip === ip)) {
            const newServersList: StoreServerItem[] = [...serversList, {
              ip,
              lastJoined: Date.now(),
              versionOverride: overrides.versionOverride,
              numConnects: 1
            }]
            setNewServersList(newServersList)
            miscUiState.loadedServerIndex = (newServersList.length - 1).toString()
          }

          if (shouldSave === undefined) { // loading saved
            // find and update
            const server = serversList.find(s => s.ip === ip)
            if (server) {
              server.lastJoined = Date.now()
              server.numConnects = (server.numConnects || 0) + 1
              setNewServersList(serversList)
            }
          }

          // save new selected proxy (if new)
          if (!proxies.includes(selectedProxy)) {
            // setProxies([...proxies, selectedProxy])
            localStorage.setItem('proxies', JSON.stringify([...proxies, selectedProxy]))
          }
          saveNewProxy()
        },
        serverIndex: shouldSave ? serversList.length.toString() : indexOrIp // assume last
      } satisfies ConnectOptions
      dispatchEvent(new CustomEvent('connect', { detail: options }))
      // qsOptions
    }}
    lockedEditing={!!customServersList}
    username={defaultUsername}
    setUsername={setDefaultUsername}
    setQuickConnectIp={setQuickConnectIp}
    onProfileClick={async () => {
      const username = await showOptionsModal('Select authenticated account to remove', authenticatedAccounts.map(a => a.username))
      if (!username) return
      setAuthenticatedAccounts(authenticatedAccounts.filter(a => a.username !== username))
    }}
    onWorldAction={(action, index) => {
      const server = serversList[index]
      if (!server) return

      if (action === 'edit') {
        setServerEditScreen(server)
      }
      if (action === 'delete') {
        setServersList(old => old.filter(s => s !== server))
      }
    }}
    onGeneralAction={(action) => {
      if (action === 'create') {
        setServerEditScreen(true)
      }
      if (action === 'cancel') {
        hideCurrentModal()
      }
    }}
    worldData={serversListSorted.map(server => {
      const additional = additionalData[server.ip]
      return {
        name: server.index.toString(),
        title: server.name || server.ip,
        detail: (server.versionOverride ?? '') + ' ' + (server.usernameOverride ?? ''),
        formattedTextOverride: additional?.formattedText,
        worldNameRight: additional?.textNameRight ?? '',
        iconSrc: additional?.icon,
        offline: additional?.offline
      }
    })}
    initialProxies={{
      proxies,
      selected: selectedProxy,
    }}
    updateProxies={({ proxies, selected }) => {
      // new proxy is saved in joinServer
      setProxies(proxies)
      setSelectedProxy(selected)
    }}
    hidden={hidden}
    onRowSelect={(_, i) => {
      setSelectedIndex(i)
    }}
    selectedRow={selectedIndex}
    serverHistory={getServerConnectionHistory()
      .sort((a, b) => b.numConnects - a.numConnects)
      .map(server => ({
        ip: server.ip,
        versionOverride: server.version,
        numConnects: server.numConnects
      }))}
  />
  return <>
    {serversListJsx}
    {editModalJsx}
  </>
}

export default () => {
  const [customServersList, setCustomServersList] = useState<string[] | undefined>(serversListQs ? [] : undefined)

  useEffect(() => {
    if (serversListQs) {
      if (serversListQs.startsWith('http')) {
        void fetch(serversListQs).then(async r => r.text()).then((text) => {
          const isJson = serversListQs.endsWith('.json') ? true : serversListQs.endsWith('.txt') ? false : text.startsWith('[')
          setCustomServersList(isJson ? JSON.parse(text) : text.split('\n').map(x => x.trim()).filter(x => x.trim().length > 0))
        }).catch((err) => {
          console.error(err)
          alert(`Failed to get servers list file: ${err}`)
        })
      } else {
        setCustomServersList(serversListQs.split(','))
      }
    }
  }, [])

  const modalStack = useSnapshot(activeModalStack)
  const hasServersListModal = modalStack.some(x => x.reactType === 'serversList')
  const editServerModalActive = useIsModalActive('editServer')
  const isServersListModalActive = useIsModalActive('serversList')

  const eitherModal = isServersListModalActive || editServerModalActive
  const render = eitherModal || hasServersListModal
  return render ? <Inner hidden={!isServersListModalActive} customServersList={customServersList} /> : null
}
