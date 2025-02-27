// import { versionsByMinecraftVersion } from 'minecraft-data'
// import minecraftInitialDataJson from '../generated/minecraft-initial-data.json'
import { AuthenticatedAccount } from './react/serversStorage'
import { downloadSoundsIfNeeded } from './sounds/botSoundSystem'
import { options } from './optionsStorage'
import supportedVersions from './supportedVersions.mjs'

export type ConnectOptions = {
  server?: string
  singleplayer?: any
  username: string
  proxy?: string
  botVersion?: any
  serverOverrides?
  serverOverridesFlat?
  peerId?: string
  ignoreQs?: boolean
  onSuccessfulPlay?: () => void
  autoLoginPassword?: string
  serverIndex?: string
  /** If true, will show a UI to authenticate with a new account */
  authenticatedAccount?: AuthenticatedAccount | true
  peerOptions?: any
  viewerWsConnect?: string
  saveServerToHistory?: boolean

  /** Will enable local replay server */
  worldStateFileContents?: string
}

export const getVersionAutoSelect = (autoVersionSelect = options.serversAutoVersionSelect) => {
  if (autoVersionSelect === 'auto') {
    return '1.20.4'
  }
  if (autoVersionSelect === 'latest') {
    return supportedVersions.at(-1)!
  }
  return autoVersionSelect
}

export const downloadMcDataOnConnect = async (version: string) => {
  // setLoadingScreenStatus(`Loading data for ${version}`)
  // // todo expose cache
  // // const initialDataVersion = Object.keys(minecraftInitialDataJson)[0]!
  // // if (version === initialDataVersion) {
  // //   // ignore cache hit
  // //   versionsByMinecraftVersion.pc[initialDataVersion]!.dataVersion!++
  // // }

  // await window._MC_DATA_RESOLVER.promise // ensure data is loaded
  // miscUiState.loadedDataVersion = version
}

export const downloadAllMinecraftData = async () => {
  await window._LOAD_MC_DATA()
}

const loadFonts = async () => {
  const FONT_FAMILY = 'mojangles'
  if (!document.fonts.check(`1em ${FONT_FAMILY}`)) {
    // todo instead re-render signs on load
    await document.fonts.load(`1em ${FONT_FAMILY}`).catch(() => {
      console.error('Failed to load font, signs wont be rendered correctly')
    })
  }
}

export const downloadOtherGameData = async () => {
  await Promise.all([loadFonts(), downloadSoundsIfNeeded()])
}
