import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { DropOverlay } from '@/components/DropOverlay'
import { ModalHost } from '@/components/ModalHost'
import { Sidebar } from '@/components/Sidebar'
import { Toasts } from '@/components/Toasts'
import { SEARCH_INPUT_ID, TopBar } from '@/components/TopBar'
import { AppDetailPage } from '@/pages/AppDetailPage'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { PresetsPage } from '@/pages/PresetsPage'
import { RandomPickerPage } from '@/pages/RandomPickerPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useLibrary } from '@/store/LibraryContext'

function useShortcuts(): void {
  const navigate = useNavigate()
  const { openAdd, modal } = useLibrary()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        document.getElementById(SEARCH_INPUT_ID)?.focus()
      } else if (key === 'n') {
        e.preventDefault()
        if (!modal) openAdd()
      } else if (key === 'r') {
        e.preventDefault()
        navigate('/random')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, openAdd, modal])
}

/** `#/library?add=1` opens the Add dialog straight away (deep link; also used for screenshots). */
function useAddDeepLink(): void {
  const [params, setParams] = useSearchParams()
  const { openAdd, loaded } = useLibrary()
  useEffect(() => {
    if (!loaded || params.get('add') !== '1') return
    openAdd()
    const next = new URLSearchParams(params)
    next.delete('add')
    setParams(next, { replace: true })
  }, [params, loaded, openAdd, setParams])
}

export function App(): JSX.Element {
  useShortcuts()
  useAddDeepLink()
  return (
    <div className="shell">
      <TopBar />
      <Sidebar />
      <div className="main">
        <main className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:id" element={<AppDetailPage />} />
            <Route path="/random" element={<RandomPickerPage />} />
            <Route path="/random/presets" element={<PresetsPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ModalHost />
      <DropOverlay />
      <Toasts />
    </div>
  )
}
