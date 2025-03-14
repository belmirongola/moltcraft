// import { versionsByMinecraftVersion } from 'minecraft-data'
// import minecraftInitialDataJson from '../generated/minecraft-initial-data.json'
import MinecraftData from 'minecraft-data'
import PrismarineBlock from 'prismarine-block'
import PrismarineItem from 'prismarine-item'
import pathfinder from 'mineflayer-pathfinder'
import { importLargeData } from '../generated/large-data-aliases'
import { miscUiState } from './globalState'
import supportedVersions from './supportedVersions.mjs'
import { options } from './optionsStorage'
import { downloadSoundsIfNeeded } from './sounds/botSoundSystem'
import { AuthenticatedAccount } from './react/serversStorage'

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
    return '1.19.4'
  }
  if (autoVersionSelect === 'latest') {
    return supportedVersions.at(-1)!
  }
  return autoVersionSelect
}

export const loadMinecraftData = async (version: string, importBlockstatesModels = false) => {
  await window._LOAD_MC_DATA()
  // setLoadingScreenStatus(`Loading data for ${version}`)
  // // todo expose cache
  // // const initialDataVersion = Object.keys(minecraftInitialDataJson)[0]!
  // // if (version === initialDataVersion) {
  // //   // ignore cache hit
  // //   versionsByMinecraftVersion.pc[initialDataVersion]!.dataVersion!++
  // // }

  const mcData = MinecraftData(version)
  window.PrismarineBlock = PrismarineBlock(mcData.version.minecraftVersion!)
  window.PrismarineItem = PrismarineItem(mcData.version.minecraftVersion!)
  window.loadedData = mcData
  window.pathfinder = pathfinder
  miscUiState.loadedDataVersion = version

  if (importBlockstatesModels) {
    viewer.world.blockstatesModels = await importLargeData('blockStatesModels')
  }
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
