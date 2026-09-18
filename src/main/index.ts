import { app, BrowserWindow, Menu, net, protocol, session } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { dataDirOverride, initialRoute, renderIcon, renderIconPath, scheduleScreenshot, screenshotPath } from './capture'
import { sweepOrphanAssets } from './apps'
import { Store } from './db'
import { registerIpc, TITLEBAR_HEIGHT } from './ipc'
import { loadWindowState, MIN_HEIGHT, MIN_WIDTH, trackWindowState } from './windowState'
import { configureUserData, getPaths, resolveInsideAssets } from './paths'
import { isSmokeRun, smokeMain } from './smoke'

/**
 * Safety Rule 5: the window is a locked-down webview.
 *  - no Node in the renderer, context isolation + sandbox on
 *  - navigation and popups blocked, all permission requests denied
 *  - cover images are served by a custom cover:// protocol that only ever
 *    reads files from the launcher's own assets folder
 */

if (isSmokeRun()) {
  // Self-test mode: point everything at a throwaway folder and never open a window.
  app.setPath('userData', process.env['SMOKE_DIR'] ?? path.join(app.getPath('temp'), 'Launchpad-smoke'))
  void app.whenReady().then(smokeMain)
} else if (dataDirOverride()) {
  app.setPath('userData', dataDirOverride()!)
} else {
  configureUserData()
}

// Lets <img src="cover://local/<file>"> work like a normal, secure origin.
protocol.registerSchemesAsPrivileged([
  { scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false } }
])

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']

function registerCoverProtocol(): void {
  protocol.handle('cover', (request) => {
    const url = new URL(request.url)
    const fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const resolved = resolveInsideAssets(fileName)
    if (!resolved) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(resolved).toString())
  })
}

function createWindow(): void {
  const stateFile = path.join(getPaths().dataDir, 'window-state.json')
  const state = loadWindowState(stateFile)
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0912',
    title: 'Launchpad',
    // Our own title bar area; Windows keeps its native minimise/maximise/close buttons + Snap Layouts.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#120f1e', symbolColor: '#ece9f7', height: TITLEBAR_HEIGHT },
    icon: app.isPackaged ? undefined : path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev
    }
  })
  mainWindow = win
  if (state.maximized) win.maximize()
  trackWindowState(win, stateFile)

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    mainWindow = null
  })
  const shot = screenshotPath()
  if (shot) scheduleScreenshot(win, shot)

  // No navigation away from our own page, and no new windows, ever.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isOurUrl(url)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (isDev) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') win.webContents.toggleDevTools()
    })
    win.loadURL(process.env['ELECTRON_RENDERER_URL']! + (initialRoute() ? `#${initialRoute()}` : ''))
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: initialRoute() ?? undefined })
  }
}

function isOurUrl(url: string): boolean {
  if (isDev) return url.startsWith(process.env['ELECTRON_RENDERER_URL']!)
  return url.startsWith(pathToFileURL(path.join(__dirname, '../renderer')).toString())
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  if (isSmokeRun()) return
  const iconFile = renderIconPath()
  if (iconFile) {
    await renderIcon(iconFile)
    return
  }
  Menu.setApplicationMenu(null)
  registerCoverProtocol()

  // Deny every web permission (camera, notifications, clipboard-read, ...).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)

  const { dbFile } = getPaths()
  const store = await Store.open(dbFile)
  registerIpc({ store, getWindow: () => mainWindow })
  void sweepOrphanAssets(store) // tidy our own assets folder; never touches anything else

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// Belt and braces: even if something asked for it, never open external content from the main process
// except through the explicit, validated launch path.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isOurUrl(url)) event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})
