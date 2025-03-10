import { ref } from 'valtio'
import { signInMessageState } from '../react/SignInMessageProvider'
import { updateAuthenticatedAccountData, updateLoadedServerData } from '../react/serversStorage'
import { setLoadingScreenStatus } from '../appStatus'
import { ConnectOptions } from '../connect'
import { showNotification } from '../react/NotificationProvider'

export const getProxyDetails = async (proxyBaseUrl: string) => {
  if (!proxyBaseUrl.startsWith('http')) proxyBaseUrl = `${isPageSecure() ? 'https' : 'http'}://${proxyBaseUrl}`
  const url = `${proxyBaseUrl}/api/vm/net/connect`
  let result: Response
  try {
    result = await fetch(url)
  } catch (err) {
    throw new Error(`Selected proxy server ${proxyBaseUrl} most likely is down`)
  }
  return result
}

export const getAuthData = async ({ tokenCaches, proxyBaseUrl, setProgressText = (text) => { }, connectingServer }) => {
  let onMsaCodeCallback
  let connectingVersion = ''
  // const authEndpoint = 'http://localhost:3000/'
  // const sessionEndpoint = 'http://localhost:3000/session'
  let authEndpoint: URL | undefined
  let sessionEndpoint: URL | undefined
  let newTokensCacheResult = null as any
  const result = await getProxyDetails(proxyBaseUrl)

  try {
    const json = await result.json()
    authEndpoint = urlWithBase(json.capabilities.authEndpoint, proxyBaseUrl)
    sessionEndpoint = urlWithBase(json.capabilities.sessionEndpoint, proxyBaseUrl)
    if (!authEndpoint) throw new Error('No auth endpoint')
  } catch (err) {
    console.error(err)
    throw new Error(`Selected proxy server ${proxyBaseUrl} does not support Microsoft authentication`)
  }
  const authFlow = {
    async getMinecraftJavaToken () {
      setProgressText('Authenticating with Microsoft account')
      if (!window.crypto && !isPageSecure()) throw new Error('Crypto API is available only in secure contexts. Be sure to use https!')
      let result = null as any
      await fetch(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...tokenCaches,
          // important to set this param and not fake it as auth server might reject the request otherwise
          connectingServer,
          connectingServerVersion: connectingVersion
        }),
      })
        .catch(e => {
          throw new Error(`Failed to connect to auth server (network error): ${e.message}`)
        })
        .then(async response => {
          if (!response.ok) {
            throw new Error(`Auth server error (${response.status}): ${await response.text()}`)
          }

          const reader = response.body!.getReader()
          const decoder = new TextDecoder('utf8')

          const processText = ({ done, value = undefined as Uint8Array | undefined }) => {
            if (done) {
              return
            }

            const processChunk = (chunkStr) => {
              let json: any
              try {
                json = JSON.parse(chunkStr)
              } catch (err) {}
              if (!json) return
              if (json.user_code) {
                onMsaCodeCallback(json)
                // this.codeCallback(json)
              }
              if (json.error) throw new Error(json.error)
              if (json.token) result = json
              if (json.newCache) newTokensCacheResult = json.newCache
            }

            const strings = decoder.decode(value)

            for (const chunk of strings.split('\n\n')) {
              processChunk(chunk)
            }

            return reader.read().then(processText)
          }
          return reader.read().then(processText)
        })
      return result
    }
  }
  return {
    authFlow,
    sessionEndpoint,
    setOnMsaCodeCallback (callback) {
      onMsaCodeCallback = callback
    },
    setConnectingVersion (version) {
      connectingVersion = version
    },
    get newTokensCacheResult () {
      return newTokensCacheResult
    }
  }
}

export const authFlowMainThread = async (worker: Worker, authData: Awaited<ReturnType<typeof getAuthData>>, connectOptions: ConnectOptions, setActionAfterJoin: (action: () => void) => void) => {
  const cachedTokens = typeof connectOptions.authenticatedAccount === 'object' ? connectOptions.authenticatedAccount.cachedTokens : {}
  signInMessageState.abortController = ref(new AbortController())
  await new Promise<void>(resolve => {
    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'authFlow') {
        authData.setConnectingVersion(data.version)
        resolve()
      }
    })
  })

  authData.setOnMsaCodeCallback((codeData) => {
    signInMessageState.code = codeData.user_code
    signInMessageState.link = codeData.verification_uri
    signInMessageState.expiresOn = Date.now() + codeData.expires_in * 1000
  })

  const data = await authData.authFlow.getMinecraftJavaToken()
  signInMessageState.code = ''
  if (!data) return
  const username = data.profile.name
  if (signInMessageState.shouldSaveToken) {
    updateAuthenticatedAccountData(accounts => {
      const existingAccount = accounts.find(a => a.username === username)
      if (existingAccount) {
        existingAccount.cachedTokens = { ...existingAccount.cachedTokens, ...authData.newTokensCacheResult }
      } else {
        accounts.push({
          username,
          cachedTokens: { ...cachedTokens, ...authData.newTokensCacheResult }
        })
      }
      showNotification(`Account ${username} saved`)
      return accounts
    })
    setActionAfterJoin(() => {
      updateLoadedServerData(s => ({ ...s, authenticatedAccountOverride: username }), connectOptions.serverIndex)
    })
  } else {
    setActionAfterJoin(() => {
      updateLoadedServerData(s => ({ ...s, authenticatedAccountOverride: undefined }), connectOptions.serverIndex)
    })
  }
  worker.postMessage({
    type: 'authflowResult',
    data
  })
  setLoadingScreenStatus('Authentication successful. Logging in to server')
}

function isPageSecure (url = window.location.href) {
  return !url.startsWith('http:')
}

const urlWithBase = (url: string, base: string) => {
  const defaultBase = isPageSecure() ? 'https' : 'http'
  if (!base.startsWith('http')) base = `${defaultBase}://${base}`
  const urlObj = new URL(url, base)
  base = base.replace(/^https?:\/\//, '')
  urlObj.host = base.includes(':') ? base : `${base}:${isPageSecure(base) ? '443' : '80'}`
  return urlObj
}
