import React from 'react'
import physicsUtilPkg from '@nxg-org/mineflayer-physics-util/package.json'
import mineflayerPkg from 'mineflayer/package.json'
import mcProtocolPkg from 'minecraft-protocol/package.json'
import { useSnapshot } from 'valtio'
import packageJson from '../../../package.json'
import { miscUiState } from '../../globalState'

const LibraryVersions: React.FC = () => {
  const versions = {
    '@nxg-org/mineflayer-physics-util': physicsUtilPkg.version,
    'mineflayer': packageJson.devDependencies['mineflayer'],
    'minecraft-protocol': mcProtocolPkg.version
  }

  const { gameLoaded } = useSnapshot(miscUiState)

  if (!gameLoaded) return null

  return (
    <div
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        left: 0,
        top: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '10px',
        borderRadius: '0 5px 5px 0',
        fontSize: '8px',
        zIndex: 1000
      }}
    >
      <div>Library Versions:</div>
      {Object.entries(versions).map(([lib, version]) => (
        <div key={lib} style={{ marginTop: '5px' }}>
          {lib}: {version}
        </div>
      ))}
    </div>
  )
}

export default LibraryVersions
