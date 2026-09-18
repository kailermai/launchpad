import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'

/**
 * Development-only helpers (ignored in packaged builds):
 *   --screenshot=<file.png>   capture the main window once it has rendered, then quit
 *   --render-icon=<file.png>  draw the launcher icon at 512px, then quit
 *   --data-dir=<folder>       use a different data folder (for trying things out safely)
 */

function argValue(name: string): string | null {
  if (app.isPackaged) return null
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

export const screenshotPath = (): string | null => argValue('screenshot')
export const renderIconPath = (): string | null => argValue('render-icon')
export const dataDirOverride = (): string | null => argValue('data-dir')
/** Initial hash route for screenshots, e.g. --route=/random */
export const initialRoute = (): string | null => {
  const route = argValue('route')
  return route ? '/' + route.replace(/^\/+/, '') : null
}

export function scheduleScreenshot(win: BrowserWindow, file: string): void {
  const delay = Number(argValue('screenshot-delay')) || 1500
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      console.log(`[screenshot] ${win.webContents.getURL()} argv=${JSON.stringify(process.argv.slice(1))}`)
      const image = await win.webContents.capturePage()
      fs.writeFileSync(file, image.toPNG())
      app.exit(0)
    }, delay)
  })
}

const ICON_HTML = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:512px;height:512px;border-radius:112px;
  background:linear-gradient(145deg,#7c6cff 0%,#4f46e5 55%,#1e1b4b 100%);
  display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.28),transparent 55%)"></div>
  <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    <circle cx="15.5" cy="8.5" r="1.4" fill="#fff" stroke="none"/>
  </svg>
</div></body></html>`

export async function renderIcon(file: string): Promise<void> {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(ICON_HTML))
  await new Promise((r) => setTimeout(r, 600))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  fs.writeFileSync(file, image.toPNG())
  win.destroy()
  app.exit(0)
}
