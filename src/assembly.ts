import { _createChunkHandle, _getLightAt, _updateLightAt } from './MCLight'

window.getBlockAt = (x, y, z) => {
  console.log('getBlockAt', x, y, z)
}
window.getChunkHandleAt = window.getChunkAt = (x, z) => {
  console.log('getChunkHandleAt', x, z)
}

window.wasm = {
  _createChunkHandle,
  _getLightAt,
  _updateLightAt
}

window.getChunkAt = (x, z) => {
  return 0
}

window.testWasm = () => {
  const handle = window.wasm._createChunkHandle(0, 0, 0, 0, 256)
  if (handle <= 0) {
    console.error('Failed to create chunk handle')
    return
  }

  const X = 0
  const Y = 0
  const Z = 0
  const ambientDarkness = 0
  // window.wasm._updateLightAt(handle, X, Y, Z)
  // window.wasm._getLightAt(handle, X, Y, Z, ambientDarkness)
  // getLightAt(chunk_handle_ptr, x_in, y_in, z_in, ambient_darkness_in)
  const lightLevel = window.wasm._getLightAt(handle, X, Y, Z, ambientDarkness)
  console.log('lightLevel', lightLevel)
}
