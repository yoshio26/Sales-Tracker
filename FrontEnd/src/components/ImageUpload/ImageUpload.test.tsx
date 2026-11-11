// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageUpload, imageFileError } from './ImageUpload'
import { ProductImage } from '../ProductImage/ProductImage'

describe('product image controls', () => {
  let container: HTMLDivElement
  let root: Root
  const create = vi.fn(() => 'blob:preview')
  const revoke = vi.fn()
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    create.mockClear(); revoke.mockClear()
    container = document.createElement('div'); document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('renders accessible placeholders for old/missing and broken photos, recovering on a new URL', async () => {
    await act(async () => root.render(<ProductImage name="Shirt" />))
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('No photo for Shirt')
    await act(async () => root.render(<ProductImage name="Shirt" src="https://res.cloudinary.com/test/broken.png" />))
    await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')))
    expect(container.querySelector('img')).toBeNull()
    await act(async () => root.render(<ProductImage name="Shirt" src="https://res.cloudinary.com/test/new.png" />))
    expect(container.querySelector('img')?.alt).toBe('Shirt photo')
  })

  it('validates size/type, accepts the exact size boundary and keeps the previous selection on invalid input', async () => {
    const change = vi.fn()
    await act(async () => root.render(<ImageUpload file={null} removed={false} onChange={change} onRemove={vi.fn()} />))
    const input = container.querySelector('input')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['gif'], 'bad.gif', { type: 'image/gif' })] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(change).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('JPEG, PNG, or WebP')
    expect(imageFileError(new File([new Uint8Array(3 * 1024 * 1024)], 'ok.png', { type: 'image/png' }))).toBe('')
    expect(imageFileError(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).toContain('3 MB')
    const photo = new File(['png'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { configurable: true, value: [photo] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(change).toHaveBeenCalledWith(photo)
    expect(input.value).toBe('')
  })

  it('previews files, removes photos and revokes object URLs on reset and unmount', async () => {
    const remove = vi.fn()
    const props = { removed: false, onChange: vi.fn(), onRemove: remove }
    await act(async () => root.render(<ImageUpload {...props} file={new File(['a'], 'a.png', { type: 'image/png' })} />))
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:preview')
    await act(async () => container.querySelector('button')!.click())
    expect(remove).toHaveBeenCalledOnce()
    await act(async () => root.render(<ImageUpload {...props} removed file={null} />))
    expect(revoke).toHaveBeenCalledWith('blob:preview')
    expect(container.querySelector('img')).toBeNull()
    await act(async () => root.render(<ImageUpload {...props} file={new File(['b'], 'b.png', { type: 'image/png' })} />))
    await act(async () => root.render(<div />))
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('supports drop selection and disallows multi-file drops', async () => {
    const change = vi.fn()
    await act(async () => root.render(<ImageUpload file={null} removed={false} onChange={change} onRemove={vi.fn()} />))
    const photo = new File(['a'], 'a.png', { type: 'image/png' })
    async function drop(files: File[]) {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: { files } })
      await act(async () => container.querySelector('.image-upload')!.dispatchEvent(event))
    }
    await drop([photo, photo])
    expect(change).not.toHaveBeenCalled()
    await drop([photo])
    expect(change).toHaveBeenCalledWith(photo)
  })
})