import { useSnapshot, proxy } from 'valtio'
import { openURL } from 'renderer/viewer/lib/simpleUtils'
import { hideCurrentModal } from '../globalState'
import { showInputsModal } from './SelectOption'
import Screen from './Screen'
import Button from './Button'
import { pixelartIcons } from './PixelartIcon'
import { useIsModalActive } from './utilsApp'

// This would be in a separate state file in a real implementation
export const proxiesState = proxy({
  proxies: [] as Array<{ id: string, url: string }>
})

export default () => {
  const { proxies } = useSnapshot(proxiesState)
  const isActive = useIsModalActive('proxies')

  if (!isActive) return null

  const addProxy = async () => {
    const result = await showInputsModal('Add Proxy', {
      url: {
        type: 'text',
        label: 'Proxy URL',
        placeholder: 'wss://your-proxy.com'
      }
    })
    if (!result) return

    proxiesState.proxies.push({
      id: Math.random().toString(36).slice(2),
      url: result.url
    })
  }

  const editProxy = async (proxy: { id: string, url: string }) => {
    const result = await showInputsModal('Edit Proxy', {
      url: {
        type: 'text',
        label: 'Proxy URL',
        placeholder: 'wss://your-proxy.com',
        defaultValue: proxy.url
      }
    })
    if (!result) return

    const index = proxiesState.proxies.findIndex(p => p.id === proxy.id)
    if (index !== -1) {
      proxiesState.proxies[index].url = result.url
    }
  }

  const removeProxy = (id: string) => {
    proxiesState.proxies = proxiesState.proxies.filter(p => p.id !== id)
  }

  return (
    <Screen title="Proxies">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {proxies.map(proxy => (
            <div key={proxy.id} style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5 }}>
              <span style={{ flex: 1 }}>{proxy.url}</span>
              <Button
                icon={pixelartIcons.edit}
                style={{ width: 24, height: 24, padding: 0 }}
                onClick={async () => editProxy(proxy)}
              />
              <Button
                icon={pixelartIcons.close}
                style={{ width: 24, height: 24, padding: 0, color: '#ff4444' }}
                onClick={() => removeProxy(proxy.id)}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Button
            style={{ flex: 1 }}
            onClick={addProxy}
          >
            Add Proxy
          </Button>
          <span style={{ fontSize: 6, color: '#aaa' }}>
            Note: You can self-host your own proxy in less than a minute with the script from
          </span>
          <Button
            style={{ fontSize: 6, padding: '2px 4px' }}
            onClick={() => openURL('https://github.com/zardoy/minecraft-everywhere')}
          >
            github.com/zardoy/minecraft-everywhere
          </Button>
        </div>
      </div>
    </Screen>
  )
}
