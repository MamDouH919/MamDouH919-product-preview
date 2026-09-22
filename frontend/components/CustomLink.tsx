"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const CustomLink = ({
  children,
  href,
  className,
  onClick,
  color,
  style,
  ariaLabel,
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  color?: string,
  style?: React.CSSProperties
  ariaLabel?: string
}) => {
  const currentPath = usePathname()
  const language = currentPath.split('/')[1]

  return (
    <Link
      href={"/" + language + href}
      className={className}
      onClick={onClick}
      style={color ? { color } : style}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}

export default CustomLink