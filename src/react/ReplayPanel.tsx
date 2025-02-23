import { useState, useEffect } from 'react'
import { filterPackets } from './packetsFilter'
import { DARK_COLORS } from './components/replay/constants'
import FilterInput from './components/replay/FilterInput'
import PacketList from './components/replay/PacketList'
import ProgressBar from './components/replay/ProgressBar'

interface Props {
  replayName: string
  packets: readonly PacketData[]
  isPlaying: boolean
  progress: { current: number; total: number }
  speed: number
  defaultFilter?: string
  customButtons: { button1: boolean; button2: boolean }
  onPlayPause?: (isPlaying: boolean) => void
  onRestart?: () => void
  onSpeedChange?: (speed: number) => void
  onFilterChange: (filter: string) => void
  onCustomButtonToggle: (button: 'button1' | 'button2') => void
  clientPacketsAutocomplete: string[]
  serverPacketsAutocomplete: string[]
}

export default function ReplayPanel ({
  replayName,
  packets,
  isPlaying,
  progress,
  speed,
  defaultFilter = '',
  customButtons,
  onPlayPause,
  onRestart,
  onSpeedChange,
  onFilterChange,
  onCustomButtonToggle,
  clientPacketsAutocomplete,
  serverPacketsAutocomplete
}: Props) {
  const [filter, setFilter] = useState(defaultFilter)
  const { filtered: filteredPackets, hiddenCount } = filterPackets(packets.slice(-500), filter)

  useEffect(() => {
    onFilterChange(filter)
  }, [filter, onFilterChange])

  return (
    <div style={{
      position: 'fixed',
      top: 18,
      right: 0,
      zIndex: 1000,
      background: DARK_COLORS.bg,
      padding: '16px',
      borderRadius: '0 0 8px 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      width: '400px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      color: DARK_COLORS.text
    }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{replayName || 'Unnamed Replay'}</div>
      <div style={{ fontSize: '8px', color: '#888888', marginTop: '-8px' }}>Integrated server emulation. Testing client...</div>

      <FilterInput
        value={filter}
        onChange={setFilter}
        hiddenCount={hiddenCount}
        shownCount={filteredPackets.length}
        onClearFilter={() => setFilter('')}
        clientPacketsAutocomplete={clientPacketsAutocomplete}
        serverPacketsAutocomplete={serverPacketsAutocomplete}
      />

      <PacketList
        packets={filteredPackets}
        filter={filter}
        maxHeight={300}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => onPlayPause?.(!isPlaying)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: DARK_COLORS.text
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            {isPlaying ? (
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            ) : (
              <path d="M8 5v14l11-7z"/>
            )}
          </svg>
        </button>

        <ProgressBar current={progress.current} total={progress.total} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onRestart}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: `1px solid ${DARK_COLORS.border}`,
            background: DARK_COLORS.input,
            color: DARK_COLORS.text,
            cursor: 'pointer'
          }}
        >
          Restart
        </button>

        <input
          type="number"
          value={speed}
          onChange={e => onSpeedChange?.(Number(e.target.value))}
          onContextMenu={e => {
            e.preventDefault()
            onSpeedChange?.(1)
          }}
          step={0.1}
          min={0.1}
          style={{
            width: '60px',
            padding: '4px',
            border: `1px solid ${DARK_COLORS.border}`,
            borderRadius: '4px',
            background: DARK_COLORS.input,
            color: DARK_COLORS.text
          }}
        />

        {[1, 2].map(num => (
          <button
            key={num}
            onClick={() => onCustomButtonToggle(`button${num}` as 'button1' | 'button2')}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: `1px solid ${DARK_COLORS.border}`,
              background: customButtons[`button${num}`]
                ? (num === 1 ? DARK_COLORS.client : DARK_COLORS.server)
                : DARK_COLORS.input,
              color: DARK_COLORS.text,
              cursor: 'pointer'
            }}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface PacketData {
  name: string
  data: any
  isFromClient: boolean
  isUpcoming: boolean
  actualVersion?: any
  position: number
  timestamp: number
}
