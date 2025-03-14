import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { isMobile } from 'renderer/viewer/lib/simpleUtils'
import styles from './input.module.css'

interface Props extends Omit<React.ComponentProps<'input'>, 'width'> {
  rootStyles?: React.CSSProperties
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement>
  validateInput?: (value: string) => CSSProperties | undefined
  width?: number
}

export default ({ autoFocus, rootStyles, inputRef, validateInput, defaultValue, width, ...inputProps }: Props) => {
  if (width) rootStyles = { ...rootStyles, width }

  const ref = useRef<HTMLInputElement>(null!)
  const [validationStyle, setValidationStyle] = useState<CSSProperties>({})
  const [value, setValue] = useState(defaultValue ?? '')

  useEffect(() => {
    setValue(inputProps.value === '' || inputProps.value ? inputProps.value : value)
  }, [inputProps.value])

  useEffect(() => {
    if (inputRef) (inputRef as any).current = ref.current
    if (!autoFocus || isMobile()) return // Don't make screen keyboard popup on mobile
    ref.current.focus()
  }, [])


  useEffect(() => {
    setValidationStyle(validateInput?.(value as any) ?? {})
  }, [value, validateInput])

  return <div id='input-container' className={styles.container} style={rootStyles}>
    <input
      ref={ref}
      className={styles.input}
      autoComplete='off'
      autoCapitalize='off'
      autoCorrect='off'
      autoSave='off'
      spellCheck='false'
      style={{ ...validationStyle }}
      {...inputProps}
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        inputProps.onChange?.(e)
      }}
    />
  </div>
}
