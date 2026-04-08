'use client'

import { useState, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export function PasswordInput({ className, error, id, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleToggle = () => {
    setShowPassword(!showPassword)
    // Focus en el input después de togglear
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={showPassword ? 'text' : 'password'}
        id={id}
        className={cn(
          'flex h-10 w-full rounded-lg border bg-transparent px-3 py-1 text-base transition-colors outline-none',
          'border-input placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
          error 
            ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' 
            : '',
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      <button
        type="button"
        onClick={handleToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={0}
      >
        {showPassword ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}