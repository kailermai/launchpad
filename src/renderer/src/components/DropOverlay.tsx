import { useEffect, useState } from 'react'
import { api } from '@/api'
import { useLibrary } from '@/store/LibraryContext'
import { IconUpload } from './Icons'

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name)
}

/**
 * Drag a .exe / .lnk / Steam .url from Explorer anywhere onto the window to
 * add it. Drop or paste an image while an entry (or the Add/Edit form) is open
 * to set its cover. Files are only read; nothing is moved or changed.
 */
export function DropOverlay(): JSX.Element | null {
  const { openAdd, toast, modal, detailApp, offerCover, refresh } = useLibrary()
  const [active, setActive] = useState(false)
  const [draggingImage, setDraggingImage] = useState(false)

  // Where a dropped / pasted image should go, if anywhere.
  const coverTarget = modal?.type === 'form' ? 'form' : modal ? null : detailApp ? 'app' : null

  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const applyCover = async (fileName: string | null): Promise<void> => {
      if (!fileName) {
        toast('That file is not a PNG, JPG or WEBP image.', 'error')
        return
      }
      if (coverTarget === 'form') {
        offerCover(fileName)
      } else if (coverTarget === 'app' && detailApp) {
        const result = await api.updateApplication(detailApp.id, {
          name: detailApp.name,
          launchType: detailApp.launchType,
          launchTarget: detailApp.launchTarget,
          coverPath: fileName,
          platformId: detailApp.platformId,
          categoryId: detailApp.categoryId,
          favorite: detailApp.favorite
        })
        if (result.ok) {
          await refresh()
          toast(`Cover updated for ${detailApp.name}.`, 'success')
        } else if (result.reason === 'invalid') {
          toast(result.message, 'error')
        }
      }
    }

    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setActive(true)
      const item = e.dataTransfer?.items?.[0]
      setDraggingImage(!!item && item.kind === 'file' && item.type.startsWith('image/'))
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
        if (isImageFile(file)) {
          if (!coverTarget) {
            toast('Open an entry (or the Add form) first, then drop the image to set its cover.', 'info')
            return
          }
          await applyCover(path ? await api.importCoverFromPath(path) : null)
          return
        }
        const meta = path ? await api.readDroppedFileMetadata(path) : null
        if (!meta) {
          toast(`This file type is not supported.\nSupported: .exe, .lnk and Steam .url shortcuts`, 'error')
          return
        }
        openAdd(meta)
      })()
    }
    const onPaste = (e: ClipboardEvent): void => {
      if (!coverTarget) return
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      void (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        await applyCover(await api.importCoverFromBytes(bytes))
      })()
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [openAdd, toast, coverTarget, detailApp, offerCover, refresh])

  if (!active) return null
  const title = draggingImage ? (coverTarget ? 'DROP TO SET COVER' : 'OPEN AN ENTRY FIRST') : 'DROP TO ADD'
  const text = draggingImage
    ? coverTarget
      ? coverTarget === 'form'
        ? 'Release to use this image as the cover'
        : `Release to use this image as the cover for ${detailApp?.name ?? 'this entry'}`
      : 'Open an entry or the Add form, then drop the image to set its cover'
    : 'Drop a .exe, .lnk or Steam .url shortcut to add it to your library'
  return (
    <div className="drop-overlay">
      <div className="box">
        <div className="icon">
          <IconUpload />
        </div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  )
}
