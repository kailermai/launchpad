import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { AppearanceProvider } from './store/AppearanceContext'
import { LibraryProvider } from './store/LibraryContext'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppearanceProvider>
      <HashRouter>
        <LibraryProvider>
          <App />
        </LibraryProvider>
      </HashRouter>
    </AppearanceProvider>
  </React.StrictMode>
)
