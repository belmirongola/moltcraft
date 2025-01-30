import React from 'react'
import physicsUtilPkg from '@nxg-org/mineflayer-physics-util/package.json'
import mineflayerPkg from 'mineflayer/package.json'
import mcProtocolPkg from 'minecraft-protocol/package.json'

const LibraryVersions: React.FC = () => {
  const versions = {
    'mineflayer-physics-util': physicsUtilPkg.version,
    'mineflayer': mineflayerPkg.version,
    'minecraft-protocol': mcProtocolPkg.version
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '0 5px 5px 0',
        fontSize: '12px',
        zIndex: 1000
      }}
    >
      <div>Library Versions:</div>
      {Object.entries(versions).map(([lib, version]) => (
        <div key={lib}>
          {lib}: {version}
        </div>
      ))}
    </div>
  )
}

export default LibraryVersions
