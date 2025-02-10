/* eslint-disable import/order */
import './importsWorkaround'
import './styles.css'
import './globals'
import './devtools'
import './entities'
import './globalDomListeners'
import './mineflayer/maps'
import './mineflayer/cameraShake'
import './shims/patchShims'
import './mineflayer/java-tester/index'
import { getServerInfo } from './mineflayer/mc-protocol'
import { onGameLoad, renderSlot } from './inventoryWindows'
import { RenderItem } from './mineflayer/items'
import initCollisionShapes from './getCollisionInteractionShapes'
import protocolMicrosoftAuth from 'minecraft-protocol/src/client/microsoftAuth'
import microsoftAuthflow from './microsoftAuthflow'
import { Duplex } from 'stream'

import 'core-js/features/array/at'
import 'core-js/features/promise/with-resolvers'

import './scaleInterface'
import { initWithRenderer } from './topRightStats'
import PrismarineBlock from 'prismarine-block'
import PrismarineItem from 'prismarine-item'

import { options, watchValue } from './optionsStorage'
import './reactUi'
import { lockUrl, onBotCreate } from './controls'
import './dragndrop'
import { possiblyCleanHandle, resetStateAfterDisconnect } from './browserfs'
import { watchOptionsAfterViewerInit, watchOptionsAfterWorldViewInit } from './watchOptions'
import downloadAndOpenFile from './downloadAndOpenFile'

import fs from 'fs'
import net from 'net'
import mineflayer from 'mineflayer'
import { WorldDataEmitter, Viewer } from 'renderer/viewer'
import pathfinder from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'

import worldInteractions from './worldInteractions'

import * as THREE from 'three'
import MinecraftData from 'minecraft-data'
import debug from 'debug'
import { defaultsDeep } from 'lodash-es'
import initializePacketsReplay from './packetsReplay'

import { initVR } from './vr'
import {
  AppConfig,
  activeModalStack,
  activeModalStacks,
  hideModal,
  insertActiveModalStack,
  isGameActive,
  miscUiState,
  showModal,
  gameAdditionalState
} from './globalState'

import { parseServerAddress } from './parseServerAddress'
import { setLoadingScreenStatus } from './appStatus'
import { isCypress } from './standaloneUtils'

import {
  removePanorama
} from './panorama'

import { startLocalServer, unsupportedLocalServerFeatures } from './createLocalServer'
import defaultServerOptions from './defaultLocalServerOptions'
import dayCycle from './dayCycle'

import { onAppLoad, resourcepackReload, resourcePackState } from './resourcePack'
import { ConnectPeerOptions, connectToPeer } from './localServerMultiplayer'
import CustomChannelClient from './customClient'
import { registerServiceWorker } from './serviceWorker'
import { appStatusState, lastConnectOptions } from './react/AppStatusProvider'

import { fsState } from './loadSave'
import { watchFov } from './rendererUtils'
import { loadInMemorySave } from './react/SingleplayerProvider'

import { ua } from './react/utils'
import { possiblyHandleStateVariable } from './googledrive'
import flyingSquidEvents from './flyingSquidEvents'
import { hideNotification, notificationProxy, showNotification } from './react/NotificationProvider'
import { saveToBrowserMemory } from './react/PauseScreen'
import { ViewerWrapper } from 'renderer/viewer/lib/viewerWrapper'
import './devReload'
import './water'
import { ConnectOptions, downloadMcDataOnConnect, getVersionAutoSelect, downloadOtherGameData, downloadAllMinecraftData } from './connect'
import { ref, subscribe } from 'valtio'
import { signInMessageState } from './react/SignInMessageProvider'
import { updateAuthenticatedAccountData, updateLoadedServerData, updateServerConnectionHistory } from './react/serversStorage'
import { versionToNumber } from 'renderer/viewer/prepare/utils'
import packetsPatcher from './packetsPatcher'
import { mainMenuState } from './react/MainMenuRenderApp'
import { ItemsRenderer } from 'mc-assets/dist/itemsRenderer'
import './mobileShim'
import { parseFormattedMessagePacket } from './botUtils'
import { getViewerVersionData, getWsProtocolStream, handleCustomChannel } from './viewerConnector'
import { getWebsocketStream } from './mineflayer/websocket-core'
import { appQueryParams, appQueryParamsArray } from './appParams'
import { updateCursor } from './cameraRotationControls'
import { pingServerVersion } from './mineflayer/minecraft-protocol-extra'
import { states } from 'minecraft-protocol'
import { initMotionTracking } from './react/uiMotion'
import { UserError } from './mineflayer/userError'

window.debug = debug
window.THREE = THREE
window.worldInteractions = worldInteractions
window.beforeRenderFrame = []

// ACTUAL CODE

void registerServiceWorker().then(() => {
  mainMenuState.serviceWorkerLoaded = true
})
watchFov()
initCollisionShapes()
initializePacketsReplay()
packetsPatcher()
onAppLoad()

// Create three.js context, add to page
let renderer: THREE.WebGLRenderer
try {
  renderer = new THREE.WebGLRenderer({
    powerPreference: options.gpuPreference,
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: true,
  })
} catch (err) {
  console.error(err)
  throw new Error(`Failed to create WebGL context, not possible to render (restart browser): ${err.message}`)
}

// renderer.localClippingEnabled = true
initWithRenderer(renderer.domElement)
const renderWrapper = new ViewerWrapper(renderer.domElement, renderer)
renderWrapper.addToPage()
watchValue(options, (o) => {
  renderWrapper.renderInterval = o.frameLimit ? 1000 / o.frameLimit : 0
  renderWrapper.renderIntervalUnfocused = o.backgroundRendering === '5fps' ? 1000 / 5 : o.backgroundRendering === '20fps' ? 1000 / 20 : undefined
})

const isFirefox = ua.getBrowser().name === 'Firefox'
if (isFirefox) {
  // set custom property
  document.body.style.setProperty('--thin-if-firefox', 'thin')
}

const isIphone = ua.getDevice().model === 'iPhone' // todo ipad?

if (isIphone) {
  document.documentElement.style.setProperty('--hud-bottom-max', '21px') // env-safe-aria-inset-bottom
}

// Create viewer
const viewer: import('renderer/viewer/lib/viewer').Viewer = new Viewer(renderer)
window.viewer = viewer
viewer.getMineflayerBot = () => bot
// todo unify
viewer.entities.getItemUv = (item) => {
  const idOrName = item.itemId ?? item.blockId
  try {
    const name = typeof idOrName === 'number' ? loadedData.items[idOrName]?.name : idOrName
    if (!name) throw new Error(`Item not found: ${idOrName}`)

    const renderInfo = renderSlot({
      name,
      nbt: null,
      ...item
    })

    if (!renderInfo) throw new Error(`Failed to get render info for item ${name}`)

    const textureThree = renderInfo.texture === 'blocks' ? viewer.world.material.map! : viewer.entities.itemsTexture!
    const img = textureThree.image

    if (renderInfo.blockData) {
      return {
        resolvedModel: renderInfo.blockData.resolvedModel,
        modelName: renderInfo.modelName!
      }
    }
    if (renderInfo.slice) {
      // Get slice coordinates from either block or item texture
      const [x, y, w, h] = renderInfo.slice
      const [u, v, su, sv] = [x / img.width, y / img.height, (w / img.width), (h / img.height)]
      return {
        u, v, su, sv,
        texture: textureThree
      }
    }

    throw new Error(`Invalid render info for item ${name}`)
  } catch (err) {
    reportError?.(err)
    // Return default UV coordinates for missing texture
    return {
      u: 0,
      v: 0,
      su: 16 / viewer.world.material.map!.image.width,
      sv: 16 / viewer.world.material.map!.image.width,
      texture: viewer.world.material.map!
    }
  }
}

viewer.entities.entitiesOptions = {
  fontFamily: 'mojangles'
}
watchOptionsAfterViewerInit()

function hideCurrentScreens () {
  activeModalStacks['main-menu'] = [...activeModalStack]
  insertActiveModalStack('', [])
}

const loadSingleplayer = (serverOverrides = {}, flattenedServerOverrides = {}) => {
  const serverSettingsQsRaw = appQueryParamsArray.serverSetting ?? []
  const serverSettingsQs = serverSettingsQsRaw.map(x => x.split(':')).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = JSON.parse(value)
    return acc
  }, {})
  void connect({ singleplayer: true, username: options.localUsername, serverOverrides, serverOverridesFlat: { ...flattenedServerOverrides, ...serverSettingsQs } })
}
function listenGlobalEvents () {
  window.addEventListener('connect', e => {
    const options = (e as CustomEvent).detail
    void connect(options)
  })
  window.addEventListener('singleplayer', (e) => {
    loadSingleplayer((e as CustomEvent).detail)
  })
}

let listeners = [] as Array<{ target, event, callback }>
let cleanupFunctions = [] as Array<() => void>
// only for dom listeners (no removeAllListeners)
// todo refactor them out of connect fn instead
const registerListener: import('./utilsTs').RegisterListener = (target, event, callback) => {
  target.addEventListener(event, callback)
  listeners.push({ target, event, callback })
}
const removeAllListeners = () => {
  for (const { target, event, callback } of listeners) {
    target.removeEventListener(event, callback)
  }
  for (const cleanupFunction of cleanupFunctions) {
    cleanupFunction()
  }
  cleanupFunctions = []
  listeners = []
}

export async function connect (connectOptions: ConnectOptions) {
  if (miscUiState.gameLoaded) return
  miscUiState.hasErrors = false
  lastConnectOptions.value = connectOptions
  removePanorama()

  const { singleplayer } = connectOptions
  const p2pMultiplayer = !!connectOptions.peerId
  miscUiState.singleplayer = singleplayer
  miscUiState.flyingSquid = singleplayer || p2pMultiplayer

  // Track server connection in history
  if (!singleplayer && !p2pMultiplayer && connectOptions.server && connectOptions.saveServerToHistory !== false) {
    const parsedServer = parseServerAddress(connectOptions.server)
    updateServerConnectionHistory(parsedServer.host, connectOptions.botVersion)
  }

  const { renderDistance: renderDistanceSingleplayer, multiplayerRenderDistance } = options

  const parsedServer = parseServerAddress(connectOptions.server)
  const server = { host: parsedServer.host, port: parsedServer.port }
  if (connectOptions.proxy?.startsWith(':')) {
    connectOptions.proxy = `${location.protocol}//${location.hostname}${connectOptions.proxy}`
  }
  if (connectOptions.proxy && location.port !== '80' && location.port !== '443' && !/:\d+$/.test(connectOptions.proxy)) {
    const https = connectOptions.proxy.startsWith('https://') || location.protocol === 'https:'
    connectOptions.proxy = `${connectOptions.proxy}:${https ? 443 : 80}`
  }
  const parsedProxy = parseServerAddress(connectOptions.proxy, false)
  const proxy = { host: parsedProxy.host, port: parsedProxy.port }
  let { username } = connectOptions

  if (connectOptions.server) {
    console.log(`connecting to ${server.host}:${server.port ?? 25_565}`)
  }
  console.log('using player username', username)

  hideCurrentScreens()
  const loggingInMsg = connectOptions.server ? 'Connecting to server' : 'Logging in'
  setLoadingScreenStatus(loggingInMsg)

  let ended = false
  let bot!: typeof __type_bot
  const destroyAll = () => {
    if (ended) return
    ended = true
    viewer.resetAll()
    localServer = window.localServer = window.server = undefined
    gameAdditionalState.viewerConnection = false

    renderWrapper.postRender = () => { }
    if (bot) {
      bot.end()
      // ensure mineflayer plugins receive this event for cleanup
      bot.emit('end', '')
      bot.removeAllListeners()
      bot._client.removeAllListeners()
      //@ts-expect-error TODO?
      bot._client = undefined
      //@ts-expect-error
      window.bot = bot = undefined
    }
    resetStateAfterDisconnect()
    cleanFs()
    removeAllListeners()
  }
  const cleanFs = () => {
    if (singleplayer && !fsState.inMemorySave) {
      possiblyCleanHandle(() => {
        // todo: this is not enough, we need to wait for all async operations to finish
      })
    }
  }
  let lastPacket = undefined as string | undefined
  const onPossibleErrorDisconnect = () => {
    if (lastPacket && bot?._client && bot._client.state !== states.PLAY) {
      appStatusState.descriptionHint = `Last Server Packet: ${lastPacket}`
    }
  }
  const handleError = (err) => {
    console.error(err)
    if (err === 'ResizeObserver loop completed with undelivered notifications.') {
      return
    }
    errorAbortController.abort()
    if (isCypress()) throw err
    miscUiState.hasErrors = true
    if (miscUiState.gameLoaded) return

    setLoadingScreenStatus(`Error encountered. ${err}`, true)
    onPossibleErrorDisconnect()
    destroyAll()
  }

  const errorAbortController = new AbortController()
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason.name === 'ServerPluginLoadFailure') {
      if (confirm(`Failed to load server plugin ${e.reason.pluginName} (invoking ${e.reason.pluginMethod}). Continue?`)) {
        return
      }
    }
    handleError(e.reason)
  }, {
    signal: errorAbortController.signal
  })
  window.addEventListener('error', (e) => {
    handleError(e.message)
  }, {
    signal: errorAbortController.signal
  })

  let clientDataStream: Duplex | undefined

  if (connectOptions.server && !connectOptions.viewerWsConnect && !parsedServer.isWebSocket) {
    console.log(`using proxy ${proxy.host}:${proxy.port || location.port}`)
    net['setProxy']({ hostname: proxy.host, port: proxy.port })
  }

  const renderDistance = singleplayer ? renderDistanceSingleplayer : multiplayerRenderDistance
  let updateDataAfterJoin = () => { }
  let localServer
  try {
    const serverOptions = defaultsDeep({}, connectOptions.serverOverrides ?? {}, options.localServerOptions, defaultServerOptions)
    Object.assign(serverOptions, connectOptions.serverOverridesFlat ?? {})
    setLoadingScreenStatus('Downloading minecraft data')
    await Promise.all([
      downloadAllMinecraftData(), // download mc data before we can use minecraft-data at all
      downloadOtherGameData()
    ])
    setLoadingScreenStatus(loggingInMsg)
    let dataDownloaded = false
    const downloadMcData = async (version: string) => {
      if (dataDownloaded) return
      dataDownloaded = true
      if (connectOptions.authenticatedAccount && (versionToNumber(version) < versionToNumber('1.19.4') || versionToNumber(version) >= versionToNumber('1.21'))) {
        // todo support it (just need to fix .export crash)
        throw new UserError('Microsoft authentication is only supported on 1.19.4 - 1.20.6 (at least for now)')
      }

      await downloadMcDataOnConnect(version)
      try {
        // TODO! reload only after login packet (delay viewer display) so no unecessary reload after server one is isntalled
        await resourcepackReload(version)
      } catch (err) {
        console.error(err)
        const doContinue = confirm('Failed to apply texture pack. See errors in the console. Continue?')
        if (!doContinue) {
          throw err
        }
      }
      setLoadingScreenStatus('Loading minecraft assets')
      viewer.world.blockstatesModels = await import('mc-assets/dist/blockStatesModels.json')
      void viewer.setVersion(version, options.useVersionsTextures === 'latest' ? version : options.useVersionsTextures)
      miscUiState.loadedDataVersion = version
    }

    let finalVersion = connectOptions.botVersion || (singleplayer ? serverOptions.version : undefined)

    if (singleplayer) {
      // SINGLEPLAYER EXPLAINER:
      // Note 1: here we have custom sync communication between server Client (flying-squid) and game client (mineflayer)
      // Note 2: custom Server class is used which simplifies communication & Client creation on it's side
      // local server started
      // mineflayer.createBot (see source def)
      // bot._client = bot._client ?? mc.createClient(options) <-- mc-protocol package
      // tcpDns() skipped since we define connect option
      // in setProtocol: we emit 'connect' here below so in that file we send set_protocol and login_start (onLogin handler)
      // Client (class) of flying-squid (in server/login.js of mc-protocol): onLogin handler: skip most logic & go to loginClient() which assigns uuid and sends 'success' back to client (onLogin handler) and emits 'login' on the server (login.js in flying-squid handler)
      // flying-squid: 'login' -> player.login -> now sends 'login' event to the client (handled in many plugins in mineflayer) -> then 'update_health' is sent which emits 'spawn' in mineflayer

      setLoadingScreenStatus('Starting local server')
      localServer = window.localServer = window.server = startLocalServer(serverOptions)
      // todo need just to call quit if started
      // loadingScreen.maybeRecoverable = false
      // init world, todo: do it for any async plugins
      if (!localServer.pluginsReady) {
        await new Promise(resolve => {
          localServer.once('pluginsReady', resolve)
        })
      }

      localServer.on('newPlayer', (player) => {
        // it's you!
        player.on('loadingStatus', (newStatus) => {
          setLoadingScreenStatus(newStatus, false, false, true)
        })
      })
      flyingSquidEvents()
    }

    if (connectOptions.authenticatedAccount) username = 'you'
    let initialLoadingText: string
    if (singleplayer) {
      initialLoadingText = 'Local server is still starting'
    } else if (p2pMultiplayer) {
      initialLoadingText = 'Connecting to peer'
    } else if (connectOptions.server) {
      if (!finalVersion) {
        const versionAutoSelect = getVersionAutoSelect()
        setLoadingScreenStatus(`Fetching server version. Preffered: ${versionAutoSelect}`)
        const autoVersionSelect = await getServerInfo(server.host, server.port ? Number(server.port) : undefined, versionAutoSelect)
        finalVersion = autoVersionSelect.version
      }
      initialLoadingText = `Connecting to server ${server.host} with version ${finalVersion}`
    } else if (connectOptions.viewerWsConnect) {
      initialLoadingText = `Connecting to Mineflayer WebSocket server ${connectOptions.viewerWsConnect}`
    } else {
      initialLoadingText = 'We have no idea what to do'
    }
    setLoadingScreenStatus(initialLoadingText)

    if (parsedServer.isWebSocket) {
      clientDataStream = (await getWebsocketStream(server.host)).mineflayerStream
    }

    let newTokensCacheResult = null as any
    const cachedTokens = typeof connectOptions.authenticatedAccount === 'object' ? connectOptions.authenticatedAccount.cachedTokens : {}
    const authData = connectOptions.authenticatedAccount ? await microsoftAuthflow({
      tokenCaches: cachedTokens,
      proxyBaseUrl: connectOptions.proxy,
      setProgressText (text) {
        setLoadingScreenStatus(text)
      },
      setCacheResult (result) {
        newTokensCacheResult = result
      },
      connectingServer: server.host
    }) : undefined

    if (p2pMultiplayer) {
      clientDataStream = await connectToPeer(connectOptions.peerId!, connectOptions.peerOptions)
    }
    if (connectOptions.viewerWsConnect) {
      const { version, time, requiresPass } = await getViewerVersionData(connectOptions.viewerWsConnect)
      let password
      if (requiresPass) {
        password = prompt('Enter password')
        if (!password) {
          throw new UserError('Password is required')
        }
      }
      console.log('Latency:', Date.now() - time, 'ms')
      // const version = '1.21.1'
      finalVersion = version
      await downloadMcData(version)
      setLoadingScreenStatus(`Connecting to WebSocket server ${connectOptions.viewerWsConnect}`)
      clientDataStream = (await getWsProtocolStream(connectOptions.viewerWsConnect)).clientDuplex
      if (password) {
        clientDataStream.write(password)
      }
      gameAdditionalState.viewerConnection = true
    }

    if (finalVersion) {
      // ensure data is downloaded
      await downloadMcData(finalVersion)
    }

    bot = mineflayer.createBot({
      host: server.host,
      port: server.port ? +server.port : undefined,
      version: finalVersion || false,
      ...clientDataStream ? {
        stream: clientDataStream as any,
      } : {},
      ...singleplayer || p2pMultiplayer ? {
        keepAlive: false,
      } : {},
      ...singleplayer ? {
        version: serverOptions.version,
        connect () { },
        Client: CustomChannelClient as any,
      } : {},
      onMsaCode (data) {
        signInMessageState.code = data.user_code
        signInMessageState.link = data.verification_uri
        signInMessageState.expiresOn = Date.now() + data.expires_in * 1000
      },
      sessionServer: authData?.sessionEndpoint?.toString(),
      auth: connectOptions.authenticatedAccount ? async (client, options) => {
        authData!.setOnMsaCodeCallback(options.onMsaCode)
        authData?.setConnectingVersion(client.version)
        //@ts-expect-error
        client.authflow = authData!.authFlow
        try {
          signInMessageState.abortController = ref(new AbortController())
          await Promise.race([
            protocolMicrosoftAuth.authenticate(client, options),
            new Promise((_r, reject) => {
              signInMessageState.abortController.signal.addEventListener('abort', () => {
                reject(new UserError('Aborted by user'))
              })
            })
          ])
          if (signInMessageState.shouldSaveToken) {
            updateAuthenticatedAccountData(accounts => {
              const existingAccount = accounts.find(a => a.username === client.username)
              if (existingAccount) {
                existingAccount.cachedTokens = { ...existingAccount.cachedTokens, ...newTokensCacheResult }
              } else {
                accounts.push({
                  username: client.username,
                  cachedTokens: { ...cachedTokens, ...newTokensCacheResult }
                })
              }
              return accounts
            })
            updateDataAfterJoin = () => {
              updateLoadedServerData(s => ({ ...s, authenticatedAccountOverride: client.username }), connectOptions.serverIndex)
            }
          } else {
            updateDataAfterJoin = () => {
              updateLoadedServerData(s => ({ ...s, authenticatedAccountOverride: undefined }), connectOptions.serverIndex)
            }
          }
          setLoadingScreenStatus('Authentication successful. Logging in to server')
        } finally {
          signInMessageState.code = ''
        }
      } : undefined,
      username,
      viewDistance: renderDistance,
      checkTimeoutInterval: 240 * 1000,
      // noPongTimeout: 240 * 1000,
      closeTimeout: 240 * 1000,
      respawn: options.autoRespawn,
      maxCatchupTicks: 0,
      'mapDownloader-saveToFile': false,
      // "mapDownloader-saveInternal": false, // do not save into memory, todo must be implemeneted as we do really care of ram
    }) as unknown as typeof __type_bot
    window.bot = bot
    if (connectOptions.viewerWsConnect) {
      void handleCustomChannel()
    }
    customEvents.emit('mineflayerBotCreated')
    if (singleplayer || p2pMultiplayer) {
      // in case of p2pMultiplayer there is still flying-squid on the host side
      const _supportFeature = bot.supportFeature
      bot.supportFeature = ((feature) => {
        if (unsupportedLocalServerFeatures.includes(feature)) {
          return false
        }
        return _supportFeature(feature)
      }) as typeof bot.supportFeature

      bot.emit('inject_allowed')
      bot._client.emit('connect')
    } else if (clientDataStream) {
      // bot.emit('inject_allowed')
      bot._client.emit('connect')
    } else {
      const setupConnectHandlers = () => {
        bot._client.socket.on('connect', () => {
          console.log('Proxy WebSocket connection established')
          //@ts-expect-error
          bot._client.socket._ws.addEventListener('close', () => {
            console.log('WebSocket connection closed')
            setTimeout(() => {
              if (bot) {
                bot.emit('end', 'WebSocket connection closed with unknown reason')
              }
            }, 1000)
          })
          bot._client.socket.on('close', () => {
            setTimeout(() => {
              if (bot) {
                bot.emit('end', 'WebSocket connection closed with unknown reason')
              }
            })
          })
        })
        let i = 0
        //@ts-expect-error
        bot.pingProxy = async () => {
          const curI = ++i
          return new Promise(resolve => {
            //@ts-expect-error
            bot._client.socket._ws.send(`ping:${curI}`)
            const date = Date.now()
            const onPong = (received) => {
              if (received !== curI.toString()) return
              bot._client.socket.off('pong' as any, onPong)
              resolve(Date.now() - date)
            }
            bot._client.socket.on('pong' as any, onPong)
          })
        }
      }
      // socket setup actually can be delayed because of dns lookup
      if (bot._client.socket) {
        setupConnectHandlers()
      } else {
        const originalSetSocket = bot._client.setSocket.bind(bot._client)
        bot._client.setSocket = (socket) => {
          if (!bot) return
          originalSetSocket(socket)
          setupConnectHandlers()
        }
      }

    }
  } catch (err) {
    handleError(err)
  }
  if (!bot) return

  const p2pConnectTimeout = p2pMultiplayer ? setTimeout(() => { throw new UserError('Spawn timeout. There might be error on the other side, check console.') }, 20_000) : undefined

  // bot.on('inject_allowed', () => {
  //   loadingScreen.maybeRecoverable = false
  // })

  bot.on('error', handleError)

  bot.on('kicked', (kickReason) => {
    console.log('You were kicked!', kickReason)
    const { formatted: kickReasonFormatted, plain: kickReasonString } = parseFormattedMessagePacket(kickReason)
    setLoadingScreenStatus(`The Minecraft server kicked you. Kick reason: ${kickReasonString}`, true, undefined, undefined, kickReasonFormatted)
    destroyAll()
  })

  // bot.emit('kicked', '{"translate":"disconnect.genericReason","with":["Internal Exception: io.netty.handler.codec.EncoderException: com.viaversion.viaversion.exception.InformativeException: Please report this on the Via support Discord or open an issue on the relevant GitHub repository\\nPacket Type: SYSTEM_CHAT, Index: 1, Type: TagType, Data: [], Packet ID: 103, Source 0: com.viaversion.viabackwards.protocol.v1_20_3to1_20_2.Protocol1_20_3To1_20_2$$Lambda/0x00007f9930f63080"]}', false)

  const packetBeforePlay = (_, __, ___, fullBuffer) => {
    lastPacket = fullBuffer.toString()
  }
  bot._client.on('packet', packetBeforePlay as any)
  const playStateSwitch = (newState) => {
    if (newState === 'play') {
      bot._client.removeListener('packet', packetBeforePlay)
    }
  }
  bot._client.on('state', playStateSwitch)

  bot.on('end', (endReason) => {
    if (ended) return
    console.log('disconnected for', endReason)
    if (endReason === 'socketClosed') {
      endReason = 'Connection with server lost'
    }
    setLoadingScreenStatus(`You have been disconnected from the server. End reason: ${endReason}`, true)
    appStatusState.showReconnect = true
    onPossibleErrorDisconnect()
    destroyAll()
    if (isCypress()) throw new Error(`disconnected: ${endReason}`)
  })

  onBotCreate()

  bot.once('login', () => {
    worldInteractions.initBot()

    setLoadingScreenStatus('Loading world')
  })

  const spawnEarlier = !singleplayer && !p2pMultiplayer
  // don't use spawn event, player can be dead
  bot.once(spawnEarlier ? 'forcedMove' : 'health', async () => {
    if (resourcePackState.isServerInstalling) {
      setLoadingScreenStatus('Downloading resource pack')
      await new Promise<void>(resolve => {
        subscribe(resourcePackState, () => {
          if (!resourcePackState.isServerDownloading) {
            setLoadingScreenStatus('Installing resource pack')
          }
          if (!resourcePackState.isServerInstalling) {
            resolve()
          }
        })
      })
    }
    window.focus?.()
    errorAbortController.abort()
    const mcData = MinecraftData(bot.version)
    window.PrismarineBlock = PrismarineBlock(mcData.version.minecraftVersion!)
    window.PrismarineItem = PrismarineItem(mcData.version.minecraftVersion!)
    window.loadedData = mcData
    window.Vec3 = Vec3
    window.pathfinder = pathfinder

    miscUiState.gameLoaded = true
    miscUiState.loadedServerIndex = connectOptions.serverIndex ?? ''
    customEvents.emit('gameLoaded')
    if (p2pConnectTimeout) clearTimeout(p2pConnectTimeout)

    setLoadingScreenStatus('Placing blocks (starting viewer)')
    localStorage.lastConnectOptions = JSON.stringify(connectOptions)
    connectOptions.onSuccessfulPlay?.()
    if (process.env.NODE_ENV === 'development' && !localStorage.lockUrl && !Object.keys(window.debugQueryParams).length) {
      lockUrl()
    }
    updateDataAfterJoin()
    if (connectOptions.autoLoginPassword) {
      bot.chat(`/login ${connectOptions.autoLoginPassword}`)
    }

    console.log('bot spawned - starting viewer')

    const center = bot.entity.position

    const worldView = window.worldView = new WorldDataEmitter(bot.world, renderDistance, center)
    watchOptionsAfterWorldViewInit()

    bot.on('physicsTick', () => updateCursor())

    void initVR()
    initMotionTracking()

    renderWrapper.postRender = () => {
      viewer.setFirstPersonCamera(null, bot.entity.yaw, bot.entity.pitch)
    }

    // Link WorldDataEmitter and Viewer
    viewer.connect(worldView)
    worldView.listenToBot(bot)
    void worldView.init(bot.entity.position)

    dayCycle()

    // Bot position callback
    function botPosition () {
      viewer.world.lastCamUpdate = Date.now()
      // this might cause lag, but not sure
      viewer.setFirstPersonCamera(bot.entity.position, bot.entity.yaw, bot.entity.pitch)
      void worldView.updatePosition(bot.entity.position)
    }
    bot.on('move', botPosition)
    botPosition()

    setLoadingScreenStatus('Setting callbacks')

    onGameLoad(() => {})

    if (appStatusState.isError) return
    setTimeout(() => {
      if (appQueryParams.suggest_save) {
        showNotification('Suggestion', 'Save the world to keep your progress!', false, undefined, async () => {
          const savePath = await saveToBrowserMemory()
          if (!savePath) return
          const saveName = savePath.split('/').pop()
          bot.end()
          // todo hot reload
          location.search = `loadSave=${saveName}`
        })
      }
    }, 600)

    setLoadingScreenStatus(undefined)
    const start = Date.now()
    let done = false
    void viewer.world.renderUpdateEmitter.on('update', () => {
      // todo might not emit as servers simply don't send chunk if it's empty
      if (!viewer.world.allChunksFinished || done) return
      done = true
      console.log('All chunks done and ready! Time from renderer open to ready', (Date.now() - start) / 1000, 's')
      viewer.render() // ensure the last state is rendered
      document.dispatchEvent(new Event('cypress-world-ready'))
    })
  })

  if (singleplayer && connectOptions.serverOverrides.worldFolder) {
    fsState.saveLoaded = true
  }

  if (!connectOptions.ignoreQs) {
    // todo cleanup
    customEvents.on('gameLoaded', () => {
      const commands = appQueryParamsArray.command ?? []
      for (let command of commands) {
        if (!command.startsWith('/')) command = `/${command}`
        bot.chat(command)
      }
    })
  }
}

const reconnectOptions = sessionStorage.getItem('reconnectOptions') ? JSON.parse(sessionStorage.getItem('reconnectOptions')!) : undefined

listenGlobalEvents()
watchValue(miscUiState, async s => {
  if (s.appLoaded) { // fs ready
    if (reconnectOptions) {
      sessionStorage.removeItem('reconnectOptions')
      if (Date.now() - reconnectOptions.timestamp < 1000 * 60 * 2) {
        void connect(reconnectOptions.value)
      }
    } else {
      if (appQueryParams.singleplayer === '1' || appQueryParams.sp === '1') {
        loadSingleplayer({}, {
          worldFolder: undefined,
          ...appQueryParams.version ? { version: appQueryParams.version } : {}
        })
      }
      if (appQueryParams.loadSave) {
        const savePath = `/data/worlds/${appQueryParams.loadSave}`
        try {
          await fs.promises.stat(savePath)
        } catch (err) {
          alert(`Save ${savePath} not found`)
          return
        }
        await loadInMemorySave(savePath)
      }
    }
  }
})

// #region fire click event on touch as we disable default behaviors
let activeTouch: { touch: Touch, elem: HTMLElement, start: number } | undefined
document.body.addEventListener('touchend', (e) => {
  if (!isGameActive(true)) return
  if (activeTouch?.touch.identifier !== e.changedTouches[0].identifier) return
  if (Date.now() - activeTouch.start > 500) {
    activeTouch.elem.dispatchEvent(new Event('longtouch', { bubbles: true }))
  } else {
    activeTouch.elem.click()
  }
  activeTouch = undefined
})
document.body.addEventListener('touchstart', (e) => {
  const ignoreElem = (e.target as HTMLElement).matches('vercel-live-feedback') || (e.target as HTMLElement).closest('.hotbar')
  if (!isGameActive(true) || ignoreElem) return
  // we always prevent default behavior to disable magnifier on ios, but by doing so we also disable click events
  e.preventDefault()
  let firstClickable // todo remove composedPath and this workaround when lit-element is fully dropped
  const path = e.composedPath() as Array<{ click?: () => void }>
  for (const elem of path) {
    if (elem.click) {
      firstClickable = elem
      break
    }
  }
  if (!firstClickable) return
  activeTouch = {
    touch: e.touches[0],
    elem: firstClickable,
    start: Date.now(),
  }
}, { passive: false })
// #endregion

void window.fetch('config.json').then(async res => res.json()).then(c => c, (error) => {
  console.warn('Failed to load optional app config.json', error)
  return {}
}).then((config: AppConfig | {}) => {
  miscUiState.appConfig = config
})

// qs open actions
if (!reconnectOptions) {
  downloadAndOpenFile().then((downloadAction) => {
    if (downloadAction) return
    if (appQueryParams.reconnect && process.env.NODE_ENV === 'development') {
      const lastConnect = JSON.parse(localStorage.lastConnectOptions ?? {})
      void connect({
        botVersion: appQueryParams.version ?? undefined,
        ...lastConnect,
        ip: appQueryParams.ip || undefined
      })
      return
    }
    if (appQueryParams.ip || appQueryParams.proxy) {
      const waitAppConfigLoad = !appQueryParams.proxy
      const openServerEditor = () => {
        hideModal()
        showModal({ reactType: 'editServer' })
      }
      showModal({ reactType: 'empty' })
      if (waitAppConfigLoad) {
        const unsubscribe = subscribe(miscUiState, checkCanDisplay)
        checkCanDisplay()
        // eslint-disable-next-line no-inner-declarations
        function checkCanDisplay () {
          if (miscUiState.appConfig) {
            unsubscribe()
            openServerEditor()
            return true
          }
        }
      } else {
        openServerEditor()
      }
    }

    void Promise.resolve().then(() => {
      // try to connect to peer
      const peerId = appQueryParams.connectPeer
      const peerOptions = {} as ConnectPeerOptions
      if (appQueryParams.server) {
        peerOptions.server = appQueryParams.server
      }
      const version = appQueryParams.peerVersion
      if (peerId) {
        let username: string | null = options.guestUsername
        if (options.askGuestName) username = prompt('Enter your username', username)
        if (!username) return
        options.guestUsername = username
        void connect({
          username,
          botVersion: version || undefined,
          peerId,
          peerOptions
        })
      }
    })

    if (appQueryParams.serversList) {
      showModal({ reactType: 'serversList' })
    }

    const viewerWsConnect = appQueryParams.viewerConnect
    if (viewerWsConnect) {
      void connect({
        username: `viewer-${Math.random().toString(36).slice(2, 10)}`,
        viewerWsConnect,
      })
    }

    if (appQueryParams.modal) {
      const modals = appQueryParams.modal.split(',')
      for (const modal of modals) {
        showModal({ reactType: modal })
      }
    }
  }, (err) => {
    console.error(err)
    alert(`Failed to download file: ${err}`)
  })
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const initialLoader = document.querySelector('.initial-loader') as HTMLElement | null
if (initialLoader) {
  initialLoader.style.opacity = '0'
  initialLoader.style.pointerEvents = 'none'
}
window.pageLoaded = true

if (!reconnectOptions) {
  void possiblyHandleStateVariable()
}
