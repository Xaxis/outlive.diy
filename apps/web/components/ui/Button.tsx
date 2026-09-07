'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn.ts'

type Variant = 'primary' | 'default' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  default: 'btn-default',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2 py-1 text-[0.75rem]',
  md: '',
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn('btn', VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
