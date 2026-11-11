import { useState } from 'react'
import './ProductImage.css'

export function ProductImage({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  return src && failedSrc !== src
    ? <img className="product-photo" src={src} alt={`${name} photo`} width={size} height={size} loading="lazy" onError={() => setFailedSrc(src)} />
    : <span className="product-photo product-photo-placeholder" role="img" aria-label={`No photo for ${name}`} style={{ width: size, height: size }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M16 8h.01" /></svg></span>
}