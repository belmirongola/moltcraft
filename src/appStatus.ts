import { hideModal, activeModalStack, showModal, miscUiState } from './globalState'
import { appStatusState, resetAppStatusState } from './react/AppStatusProvider'

let ourLastStatus: string | undefined = ''
export const setLoadingScreenStatus = function (status: string | undefined | null, isError = false, hideDots = false, fromFlyingSquid = false, minecraftJsonMessage?: Record<string, any>) {
  // null can come from flying squid, should restore our last status
  if (status === null) {
    status = ourLastStatus
  } else if (!fromFlyingSquid) {
    ourLastStatus = status
  }
  fromFlyingSquid = false

  if (status === undefined) {
    appStatusState.status = ''

    hideModal({ reactType: 'app-status' }, {}, { force: true })
    return
  }

  if (!activeModalStack.some(x => x.reactType === 'app-status')) {
    // just showing app status
    resetAppStatusState()
  }
  showModal({ reactType: 'app-status' })
  if (appStatusState.isError) {
    miscUiState.gameLoaded = false
    return
  }
  appStatusState.hideDots = hideDots
  appStatusState.isError = isError
  appStatusState.lastStatus = isError ? appStatusState.status : ''
  appStatusState.status = status
  appStatusState.minecraftJsonMessage = minecraftJsonMessage ?? null
}
globalThis.setLoadingScreenStatus = setLoadingScreenStatus
