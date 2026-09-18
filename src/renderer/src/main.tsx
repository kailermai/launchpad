import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { LibraryProvider } from './store/LibraryContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </HashRouter>
  </React.StrictMode>
)
