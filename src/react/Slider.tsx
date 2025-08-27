// Slider.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import styles from './slider.module.css'
import SharedHudVars from './SharedHudVars'

interface Props extends React.ComponentProps<'div'> {
  label: string;
  value: number;
  unit?: string;
  width?: number;
  valueDisplay?: string | number;
  min?: number;
  max?: number;
  disabledReason?: string;
  throttle?: number | false; // milliseconds, default 100, false to disable

  updateValue?: (value: number) => void;
  updateOnDragEnd?: boolean;
}

const Slider: React.FC<Props> = ({
  label,
  unit = '%',
  width,
  value: valueProp,
  valueDisplay,
  min = 0,
  max = 100,
  disabledReason,
  throttle = 0,

  updateOnDragEnd = false,
  updateValue,
  ...divProps
}) => {
  label = translate(label)
  disabledReason = translate(disabledReason)
  valueDisplay = typeof valueDisplay === 'string' ? translate(valueDisplay) : valueDisplay

  const [value, setValue] = useState(valueProp)
  const getRatio = (v = value) => Math.max(Math.min((v - min) / (max - min), 1), 0)
  const [ratio, setRatio] = useState(getRatio())

  // Throttling refs
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastValueRef = useRef<number>(valueProp)

  useEffect(() => {
    setValue(valueProp)
  }, [valueProp])
  useEffect(() => {
    setRatio(getRatio())
  }, [value, min, max])

  const throttledUpdateValue = useCallback((newValue: number, dragEnd: boolean) => {
    if (updateOnDragEnd !== dragEnd) return
    if (!updateValue) return

    lastValueRef.current = newValue

    if (!throttle) {
      // No throttling
      updateValue(newValue)
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      updateValue(lastValueRef.current)
      timeoutRef.current = null
    }, throttle)
  }, [updateValue, updateOnDragEnd, throttle])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        // Fire the last value immediately on cleanup
        if (updateValue && lastValueRef.current !== undefined) {
          updateValue(lastValueRef.current)
        }
      }
    }
  }, [updateValue])

  const fireValueUpdate = (dragEnd: boolean, v = value) => {
    throttledUpdateValue(v, dragEnd)
  }

  const labelText = `${label}: ${valueDisplay ?? value} ${unit}`

  return (
    <SharedHudVars>
      <div className={`${styles['slider-container']} settings-text-container ${labelText.length > 17 ? 'settings-text-container-long' : ''}`} style={{ width }} {...divProps}>
        <input
          type="range"
          className={styles.slider}
          min={min}
          max={max}
          value={value}
          disabled={!!disabledReason}
          onChange={(e) => {
            const newValue = Number(e.target.value)
            setValue(newValue)
            fireValueUpdate(false, newValue)
          }}
          // todo improve correct handling of drag end
          onLostPointerCapture={() => {
            fireValueUpdate(true)
          }}
          onPointerUp={() => {
            fireValueUpdate(true)
          }}
          onKeyUp={() => {
            fireValueUpdate(true)
          }}
        />
        <div className={styles.disabled} title={disabledReason} />
        <div className={styles['slider-thumb']} style={{ left: `calc((100% * ${ratio}) - (8px * ${ratio}))` }} />
        <label className={styles.label}>
          {labelText}
        </label>
      </div>
    </SharedHudVars>
  )
}

export default Slider
