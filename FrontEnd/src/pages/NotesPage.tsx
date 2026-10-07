import { useEffect, useRef, useState } from 'react'
import styles from '../App.module.css'

type Note = { id: string; content: string; createdAt: string; updatedAt: string }

type NotesPageProps = { api: (path: string, options?: RequestInit) => Promise<Response> }

export function NotesPage({ api }: NotesPageProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const newNoteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void api('').then(async (response) => {
      if (!response.ok) throw new Error('Unable to load notes.')
      const data = await response.json() as { notes: Note[] }
      setNotes(data.notes)
    }).catch(() => setError('Unable to load your notes. Try again.')).finally(() => setLoading(false))
  }, [api])

  async function addNote() {
    setError('')
    setSaving('new')
    try {
      const response = await api('', { method: 'POST', body: JSON.stringify({ content: '' }) })
      if (!response.ok) throw new Error('Unable to add note.')
      const data = await response.json() as { note: Note }
      setNotes((current) => [data.note, ...current])
      window.setTimeout(() => newNoteRef.current?.focus(), 0)
    } catch {
      setError('Unable to add a note. Try again.')
    } finally {
      setSaving(null)
    }
  }

  async function saveNote(note: Note, content: string) {
    if (content === note.content) return
    setSaving(note.id)
    try {
      const response = await api(`/${note.id}`, { method: 'PUT', body: JSON.stringify({ content }) })
      if (!response.ok) throw new Error('Unable to save note.')
      const data = await response.json() as { note: Note }
      setNotes((current) => current.map((item) => item.id === note.id ? data.note : item))
    } catch {
      setError('Unable to save that note. Try again.')
    } finally {
      setSaving(null)
    }
  }

  async function removeNote(id: string) {
    setError('')
    const response = await api(`/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError('Unable to delete that note. Try again.')
      return
    }
    setNotes((current) => current.filter((note) => note.id !== id))
  }

  return <section className={styles.notesPage} aria-labelledby="notes-heading">
    <div className={styles.notesIntro}>
      <div><h2 id="notes-heading">Your notes</h2><p>Keep quick reminders, ideas, and to-dos close at hand.</p></div>
      <button type="button" onClick={() => void addNote()} disabled={saving === 'new'}>{saving === 'new' ? 'Adding…' : 'Add'}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p role="status">Loading notes…</p> : notes.length === 0 ? <div className={styles.notesEmpty}><span aria-hidden="true">✦</span><h3>No notes yet</h3><p>Click Add to create your first sticky note.</p></div> : <div className={styles.notesGrid}>
      {notes.map((note, index) => <article className={`${styles.stickyNote} ${styles[`stickyNote${index % 4}`]}`} key={note.id}>
        <div className={styles.stickyNoteHeader}><span>Note</span><button type="button" className={styles.noteDelete} aria-label="Delete note" onClick={() => void removeNote(note.id)}>×</button></div>
        <textarea ref={index === 0 && note.content === '' ? newNoteRef : undefined} aria-label={`Note ${index + 1}`} defaultValue={note.content} onBlur={(event) => void saveNote(note, event.target.value)} placeholder="Write something…" maxLength={5000} />
        <small>{saving === note.id ? 'Saving…' : 'Saved'}</small>
      </article>)}
    </div>}
  </section>
}
