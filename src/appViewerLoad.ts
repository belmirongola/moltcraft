import { subscribeKey } from 'valtio/utils'
import createGraphicsBackend from 'renderer/viewer/three/graphicsBackend'
import { options } from './optionsStorage'
import { appViewer } from './appViewer'
import { miscUiState } from './globalState'
import { watchOptionsAfterViewerInit } from './watchOptions'

const loadBackend = () => {
  if (options.activeRenderer === 'webgpu') {
    // appViewer.loadBackend(createWebgpuBackend)
  } else {
    appViewer.loadBackend(createGraphicsBackend)
  }
}
window.loadBackend = loadBackend
if (process.env.SINGLE_FILE_BUILD_MODE) {
  const unsub = subscribeKey(miscUiState, 'fsReady', () => {
    if (miscUiState.fsReady) {
      // don't do it earlier to load fs and display menu faster
      loadBackend()
      unsub()
    }
  })
} else {
  loadBackend()
}

const animLoop = () => {
  for (const fn of beforeRenderFrame) fn()
  requestAnimationFrame(animLoop)
}
requestAnimationFrame(animLoop)

watchOptionsAfterViewerInit()
