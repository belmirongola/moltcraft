import React, { useEffect } from 'react'
import { appQueryParams } from '../appParams'
import { fetchServerStatus, isServerValid } from '../api/mcStatusApi'
import { parseServerAddress } from '../parseServerAddress'
import Screen from './Screen'
import Input from './Input'
import Button from './Button'
import SelectGameVersion from './SelectGameVersion'
import { useIsSmallWidth, usePassesWindowDimensions } from './simpleHooks'

export interface BaseServerInfo {
  ip: string
  name?: string
  versionOverride?: string
  proxyOverride?: string
  usernameOverride?: string
  /** Username or always use new if true */
  authenticatedAccountOverride?: string | true
}

interface Props {
  onBack: () => void
  onConfirm: (info: BaseServerInfo) => void
  title?: string
  initialData?: BaseServerInfo
  parseQs?: boolean
  onQsConnect?: (server: BaseServerInfo) => void
  placeholders?: Pick<BaseServerInfo, 'proxyOverride' | 'usernameOverride'>
  accounts?: string[]
  authenticatedAccounts?: number
  versions?: string[]
  allowAutoConnect?: boolean
}

const ELEMENTS_WIDTH = 190

export default ({ onBack, onConfirm, title = 'Add a Server', initialData, parseQs, onQsConnect, placeholders, accounts, versions, allowAutoConnect }: Props) => {
  const isSmallHeight = !usePassesWindowDimensions(null, 350)
  const qsParamName = parseQs ? appQueryParams.name : undefined
  const qsParamIp = parseQs ? appQueryParams.ip : undefined
  const qsParamVersion = parseQs ? appQueryParams.version : undefined
  const qsParamProxy = parseQs ? appQueryParams.proxy : undefined
  const qsParamUsername = parseQs ? appQueryParams.username : undefined
  const qsParamLockConnect = parseQs ? appQueryParams.lockConnect : undefined

  const parsedQsIp = parseServerAddress(qsParamIp)
  const parsedInitialIp = parseServerAddress(initialData?.ip)

  const [serverName, setServerName] = React.useState(initialData?.name ?? qsParamName ?? '')
  const [serverIp, setServerIp] = React.useState(parsedQsIp.host || parsedInitialIp.host || '')
  const [serverPort, setServerPort] = React.useState(parsedQsIp.port || parsedInitialIp.port || '')
  const [versionOverride, setVersionOverride] = React.useState(initialData?.versionOverride ?? /* legacy */ initialData?.['version'] ?? qsParamVersion ?? '')
  const [proxyOverride, setProxyOverride] = React.useState(initialData?.proxyOverride ?? qsParamProxy ?? '')
  const [usernameOverride, setUsernameOverride] = React.useState(initialData?.usernameOverride ?? qsParamUsername ?? '')
  const lockConnect = qsParamLockConnect === 'true'

  const smallWidth = useIsSmallWidth()
  const initialAccount = initialData?.authenticatedAccountOverride
  const [accountIndex, setAccountIndex] = React.useState(initialAccount === true ? -2 : initialAccount ? (accounts?.includes(initialAccount) ? accounts.indexOf(initialAccount) : -2) : -1)

  const freshAccount = accountIndex === -2
  const noAccountSelected = accountIndex === -1
  const authenticatedAccountOverride = noAccountSelected ? undefined : freshAccount ? true : accounts?.[accountIndex]

  let ipFinal = serverIp.includes(':') ? serverIp : `${serverIp}${serverPort ? `:${serverPort}` : ''}`
  ipFinal = ipFinal.replace(/:$/, '')
  const commonUseOptions: BaseServerInfo = {
    name: serverName,
    ip: ipFinal,
    versionOverride: versionOverride || undefined,
    proxyOverride: proxyOverride || undefined,
    usernameOverride: usernameOverride || undefined,
    authenticatedAccountOverride,
  }

  const [fetchedServerInfoIp, setFetchedServerInfoIp] = React.useState<string | undefined>(undefined)
  const [serverOnline, setServerOnline] = React.useState(null as boolean | null)
  const [onlinePlayersList, setOnlinePlayersList] = React.useState<string[]>([])

  useEffect(() => {
    const controller = new AbortController()

    const checkServer = async () => {
      if (!qsParamIp || !isServerValid(qsParamIp)) return

      try {
        const status = await fetchServerStatus(qsParamIp)
        if (!status) return

        setServerOnline(status.raw.online)
        setOnlinePlayersList(status.raw.players?.list.map(p => p.name_raw) ?? [])
        setFetchedServerInfoIp(qsParamIp)
      } catch (err) {
        console.error('Failed to fetch server status:', err)
      }
    }

    void checkServer()
    return () => controller.abort()
  }, [qsParamIp])

  const validateUsername = (username: string) => {
    if (!username) return undefined
    if (onlinePlayersList.includes(username)) {
      return { border: 'red solid 1px' }
    }
    const MINECRAFT_USERNAME_REGEX = /^\w{3,16}$/
    if (!MINECRAFT_USERNAME_REGEX.test(username)) {
      return { border: 'red solid 1px' }
    }
    return undefined
  }

  const validateServerIp = () => {
    if (!serverIp) return undefined
    if (serverOnline) {
      return { border: 'lightgreen solid 1px' }
    } else {
      return { border: 'red solid 1px' }
    }
  }

  useEffect(() => {
    if (qsParamIp && qsParamVersion && allowAutoConnect) {
      onQsConnect?.(commonUseOptions)
    }
  }, [])

  return <Screen title={qsParamIp ? 'Connect to Server' : title} backdrop>
    <form
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
      onSubmit={(e) => {
        e.preventDefault()
        onConfirm(commonUseOptions)
      }}
    >
      <div style={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: smallWidth ? '1fr' : '1fr 1fr'
      }}
      >
        {!lockConnect && <>
          <div style={{ gridColumn: smallWidth ? '' : 'span 2', display: 'flex', justifyContent: 'center' }}>
            <InputWithLabel label="Server Name" value={serverName} onChange={({ target: { value } }) => setServerName(value)} placeholder='Defaults to IP' />
          </div>
        </>}
        <InputWithLabel
          required
          label="Server IP"
          value={serverIp}
          disabled={lockConnect && parsedQsIp.host !== null}
          onChange={({ target: { value } }) => {
            setServerIp(value)
            setServerOnline(false)
          }}
          validateInput={serverOnline === null || fetchedServerInfoIp !== serverIp ? undefined : validateServerIp}
        />
        <InputWithLabel label="Server Port" value={serverPort} disabled={lockConnect && parsedQsIp.port !== null} onChange={({ target: { value } }) => setServerPort(value)} placeholder={serverIp.startsWith('ws://') || serverIp.startsWith('wss://') ? '' : '25565'} />
        {isSmallHeight ? <div style={{ gridColumn: 'span 2', marginTop: 10, }} /> : <div style={{ gridColumn: smallWidth ? '' : 'span 2' }}>Overrides:</div>}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
        }}>
          <label style={{ fontSize: 12, marginBottom: 1, color: 'lightgray' }}>Version Override</label>
          <SelectGameVersion
            selected={{ value: versionOverride, label: versionOverride }}
            versions={versions?.map(v => { return { value: v, label: v } }) ?? []}
            onChange={(value) => {
              setVersionOverride(value)
            }}
            placeholder="Optional, but recommended to specify"
            disabled={lockConnect}
          />
        </div>

        <InputWithLabel
          label="Proxy Override"
          value={proxyOverride}
          disabled={lockConnect && (qsParamProxy !== null || !!placeholders?.proxyOverride) || serverIp.startsWith('ws://') || serverIp.startsWith('wss://')}
          onChange={({ target: { value } }) => setProxyOverride(value)}
          placeholder={serverIp.startsWith('ws://') || serverIp.startsWith('wss://') ? 'Not needed for websocket servers' : placeholders?.proxyOverride}
        />
        <InputWithLabel
          label="Username Override"
          value={usernameOverride}
          disabled={!noAccountSelected || (lockConnect && qsParamUsername !== null)}
          onChange={({ target: { value } }) => setUsernameOverride(value)}
          placeholder={placeholders?.usernameOverride}
          validateInput={!serverOnline || fetchedServerInfoIp !== serverIp ? undefined : validateUsername}
        />
        <label style={{
          display: 'flex',
          flexDirection: 'column',
        }}
        >
          <span style={{ fontSize: 12, marginBottom: 1, color: 'lightgray' }}>Account Override</span>
          <select
            onChange={({ target: { value } }) => setAccountIndex(Number(value))}
            style={{
              background: 'gray',
              color: 'white',
              height: 20,
              fontSize: 13,
            }}
            defaultValue={initialAccount === true ? -2 : initialAccount === undefined ? -1 : (fallbackIfNotFound((accounts ?? []).indexOf(initialAccount)) ?? -2)}
            disabled={lockConnect && qsParamUsername !== null}
          >
            <option value={-1}>Offline Account (Username)</option>
            {accounts?.map((account, i) => <option key={i} value={i}>{account} (Logged In)</option>)}
            <option value={-2}>Any other MS account</option>
          </select>
        </label>

        {!lockConnect && <>
          <ButtonWrapper onClick={() => {
            onBack()
          }}>Cancel</ButtonWrapper>
          <ButtonWrapper type='submit'>Save</ButtonWrapper>
        </>}
        {qsParamIp && <div style={{ gridColumn: smallWidth ? '' : 'span 2', display: 'flex', justifyContent: 'center' }}>
          <ButtonWrapper
            data-test-id='connect-qs'
            onClick={() => {
              onQsConnect?.(commonUseOptions)
            }}
          ><strong>Connect</strong></ButtonWrapper>
        </div>}
      </div>
    </form>
  </Screen>
}

const ButtonWrapper = ({ ...props }: React.ComponentProps<typeof Button>) => {
  props.style ??= {}
  props.style.width = ELEMENTS_WIDTH
  return <Button {...props} />
}

const InputWithLabel = ({ label, span, ...props }: React.ComponentProps<typeof Input> & { label, span? }) => {
  return <div style={{
    display: 'flex',
    flexDirection: 'column',
    gridRow: span ? 'span 2 / span 2' : undefined,
  }}
  >
    <label style={{ fontSize: 12, marginBottom: 1, color: 'lightgray' }}>{label}</label>
    <Input rootStyles={{ width: ELEMENTS_WIDTH }} {...props} />
  </div>
}

const fallbackIfNotFound = (index: number) => (index === -1 ? undefined : index)
