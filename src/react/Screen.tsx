interface Props {
  title: JSX.Element | string
  children: React.ReactNode
  backdrop?: boolean | 'dirt'
  style?: React.CSSProperties
  className?: string
  titleSelectable?: boolean
  titleMarginTop?: number
  contentStyle?: React.CSSProperties
}

export default ({ title, children, backdrop = true, style, className = '', titleSelectable, titleMarginTop, contentStyle }: Props) => {
  return (
    <>
      {backdrop === 'dirt' ? <div className='dirt-bg' /> : backdrop ? <div className="backdrop" /> : null}
      <div className={`fullscreen ${className}`} style={{ ...style }}>
        <div className="screen-content" style={{ ...contentStyle, ...(titleMarginTop === undefined ? {} : { marginTop: titleMarginTop }) }}>
          <div className={`screen-title ${titleSelectable ? 'text-select' : ''}`}>{title}</div>
          {children}
        </div>
      </div>
    </>
  )
}
