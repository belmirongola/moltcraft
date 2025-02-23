const qsParams = new URLSearchParams(window.location?.search ?? '')

export type AppQsParams = {
  // AddServerOrConnect.tsx params
  ip?: string
  name?: string
  version?: string
  proxy?: string
  username?: string
  lockConnect?: string
  autoConnect?: string
  // googledrive.ts params
  state?: string
  // ServersListProvider.tsx params
  serversList?: string
  // Map and texture params
  texturepack?: string
  map?: string
  mapDirBaseUrl?: string
  mapDirGuess?: string
  // Singleplayer params
  singleplayer?: string
  sp?: string
  loadSave?: string
  // Server params
  reconnect?: string
  server?: string
  // Peer connection params
  connectPeer?: string
  peerVersion?: string
  // UI params
  modal?: string
  viewerConnect?: string
  // Map version param
  mapVersion?: string
  // Command params
  command?: string
  // Misc params
  suggest_save?: string
  noPacketsValidation?: string
  testCrashApp?: string

  // Replay params
  replayFilter?: string
  replaySpeed?: string
  replayFileUrl?: string
  replayValidateClient?: string
}

export type AppQsParamsArray = {
  mapDir?: string[]
  setting?: string[]
  serverSetting?: string[]
  command?: string[]
}

type AppQsParamsArrayTransformed = {
  [k in keyof AppQsParamsArray]: string[]
}

export const appQueryParams = new Proxy<AppQsParams>({} as AppQsParams, {
  get (target, property) {
    if (typeof property !== 'string') {
      return undefined
    }
    return qsParams.get(property)
  },
})

export const appQueryParamsArray = new Proxy({} as AppQsParamsArrayTransformed, {
  get (target, property) {
    if (typeof property !== 'string') {
      return null
    }
    return qsParams.getAll(property)
  },
})

// Helper function to check if a specific query parameter exists
export const hasQueryParam = (param: keyof AppQsParams) => qsParams.has(param)

// Helper function to get all query parameters as a URLSearchParams object
export const getRawQueryParams = () => qsParams;

(globalThis as any).debugQueryParams = Object.fromEntries(qsParams.entries())
