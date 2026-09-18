import { useEffect, useState } from 'react'
import { api } from '@/api'
import { useLibrary } from '@/store/LibraryContext'

/**
 * Drag a .exe or .lnk from Explorer anywhere onto the window to add it.
 * Dropping only reads the file's metadata; the file itself is never moved,
 * copied or changed. Folders and other file types are politely refused.
 */
export function DropOverlay(): JSX.Element | null {
  const { openAdd, toast } = useLibrary()
  const [active, setActive] = useState(false)
  const [label, setLabel] = useState<string>('')

  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setActive(true)
      const item = e.dataTransfer?.items?.[0]
      setLabel(item && item.kind === 'file' ? 'Release to add this application' : '')
    }
    const onOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'link'
    }
    const onLeave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setActive(false)
    }
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      depth = 0
      setActive(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return
      if (files.length > 1) toast('Drop one file at a time.', 'error')
      const file = files[0]
      void (async () => {
        const path = api.getPathForFile(file)
        const meta = path ? await api.readDroppedFileMetadata(path) : null
        if (!meta) {
          toast(`This file type is not supported.\nSupported: .exe and .lnk`, 'error')
          return
        }
        openAdd(meta)
      })()
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openAdd, toast])

  if (!active) return null
  return (
    <div className="drop-overlay">
      <div className="box">
        <h2>DROP TO ADD</h2>
        <p>{label || 'Drop a .exe or .lnk to add it to your library'}</p>
      </div>
    </div>
  )
}
