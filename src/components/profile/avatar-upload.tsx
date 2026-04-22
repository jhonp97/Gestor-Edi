/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'

const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarUpload({
  currentImage,
  onUploaded,
}: {
  currentImage: string | null
  onUploaded: (url: string) => void
}) {
  const [preview, setPreview] = useState(currentImage)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { post } = useApi()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage('Formato no soportado. Use JPG, PNG o WEBP')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setMessage('La imagen no debe superar 5MB')
      return
    }

    setMessage('')
    uploadFile(file)
  }

  async function uploadFile(file: File) {
    setLoading(true)
    try {
      const { signature, timestamp, cloudName, apiKey, folder } = await post<{
        signature: string
        timestamp: number
        cloudName: string
        apiKey: string
        folder: string
      }>('/api/upload/signature', { folder: 'profiles' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('folder', folder)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Error al subir imagen')
      }

      const data = await res.json()
      const url = data.secure_url as string
      setPreview(url)
      onUploaded(url)
      setMessage('Imagen actualizada')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-muted">
        {preview ? (
          <img src={preview} alt="Avatar" className="size-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">?</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Subiendo...' : 'Cambiar foto'}
        </Button>
        {message && (
          <p className={`mt-1 text-xs ${message.includes('Error') || message.includes('Formato') || message.includes('5MB') ? 'text-destructive' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
