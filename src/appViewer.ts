import { Vec3 } from 'vec3'
import { subscribe } from 'valtio'
import { AppViewer, getInitialPlayerState } from 'minecraft-renderer/src'
import { activeModalStack, miscUiState } from './globalState'

// do not import this. Use global appViewer instead (without window prefix).
export const appViewer = new AppViewer()
window.appViewer = appViewer

const initialMenuStart = async () => {
  if (appViewer.currentDisplay === 'world') {
    appViewer.resetBackend(true)
  }
  const demo = new URLSearchParams(window.location.search).get('demo')
  if (!demo) {
    appViewer.startPanorama()
    return
  }

  // const version = '1.18.2'
  const version = '1.21.4'
  const { loadMinecraftData } = await import('./connect')
  const { getSyncWorld } = await import('minecraft-renderer/src/playground/shared')
  await loadMinecraftData(version)
  const world = getSyncWorld(version)
  world.setBlockStateId(new Vec3(0, 64, 0), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(1, 64, 0), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(1, 64, 1), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(0, 64, 1), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(-1, 64, -1), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(-1, 64, 0), loadedData.blocksByName.water.defaultState)
  world.setBlockStateId(new Vec3(0, 64, -1), loadedData.blocksByName.water.defaultState)
  appViewer.resourcesManager.currentConfig = { version }
  appViewer.playerState.reactive = getInitialPlayerState()
  await appViewer.resourcesManager.updateAssetsData({})
  await appViewer.startWorld(world, 3)
  appViewer.backend!.updateCamera(new Vec3(0, 65.7, 0), 0, -Math.PI / 2) // Y+1 and pitch = PI/2 to look down
  void appViewer.worldView!.init(new Vec3(0, 64, 0))
}
window.initialMenuStart = initialMenuStart

const hasAppStatus = () => activeModalStack.some(m => m.reactType === 'app-status')

export const onAppViewerConfigUpdate = () => {
  appViewer.inWorldRenderingConfig.skinTexturesProxy = miscUiState.appConfig?.skinTexturesProxy
}

export const modalStackUpdateChecks = () => {
  // maybe start panorama
  if (!miscUiState.gameLoaded && !hasAppStatus()) {
    void initialMenuStart()
  }

  if (appViewer.backend) {
    appViewer.backend.setRendering(!hasAppStatus())
  }

  appViewer.inWorldRenderingConfig.foreground = activeModalStack.length === 0
}
subscribe(activeModalStack, modalStackUpdateChecks)
