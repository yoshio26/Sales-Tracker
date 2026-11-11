import { useEffect, useId, useState } from 'react'
import { ProductImage } from '../ProductImage/ProductImage'
import './ImageUpload.css'

export function imageFileError(file: File): string {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP photo.'
  if (file.size > 3 * 1024 * 1024) return 'Photo must be 3 MB or smaller.'
  return ''
}

export function ImageUpload({ file, existingUrl, removed, disabled, onChange, onRemove }: { file: File | null; existingUrl?: string | null; removed: boolean; disabled?: boolean; onChange: (file: File) => void; onRemove: () => void }) {
  const id = useId()
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function choose(candidate?: File) {
    if (!candidate || disabled) return
    const issue = imageFileError(candidate)
    setError(issue)
    if (!issue) onChange(candidate)
  }
  return <div className="image-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { setError('Choose one photo.'); return }; choose(event.dataTransfer.files[0]) }}>
    <label htmlFor={id}>Product photo (optional)</label>
    <div><ProductImage src={preview ?? (removed ? null : existingUrl)} name="Product preview" size={220} /><span>Choose or drop a JPEG, PNG, or WebP, up to 3 MB.</span></div>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={`${id}-help`} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} />
    <p id={`${id}-help`}>The same photo is used for each stock in a multiple-stock save.</p>
    {(file || (existingUrl && !removed)) && <button type="button" disabled={disabled} onClick={() => { setError(''); onRemove() }}>Remove photo</button>}
    {error && <p role="alert">{error}</p>}
  </div>
}