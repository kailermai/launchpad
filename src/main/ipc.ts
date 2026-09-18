import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC, type IpcChannel } from '../shared/ipc'
import type { AppInfo } from '../shared/types'
import {
  addApplication,
  bulkUpdateApplications,
  refreshIcons,
  removeApplications,
  restoreApplications,
  updateApplication
} from './apps'
import { importBackup, exportBackup, inspectBackup } from './backup'
import type { Store } from './db'
import {
  chooseApplicationFile,
  chooseCoverImage,
  importCoverFromBytes,
  importDroppedCover,
  openDataFolder,
  readDroppedFileMetadata
} from './files'
import { checkAllTargets, checkTarget, launchApplication } from './launch'
import { getPaths } from './paths'
import { assertId, assertIdList, validateLabel } from './validate'

interface Context {
  store: Store
  getWindow: () => BrowserWindow | null
}

/** Height of the custom title bar; must match --titlebar-h in the renderer. */
export const TITLEBAR_HEIGHT = 40

/**
 * The complete list of things the UI can ask the main process to do.
 * Every handler checks the request came from our own window and validates
 * its arguments before touching anything.
 */
export function registerIpc(ctx: Context): void {
  const requireWindow = (event: IpcMainInvokeEvent): BrowserWindow => {
    const win = ctx.getWindow()
    if (!win || event.sender !== win.webContents) throw new Error('Untrusted sender.')
    return win
  }

  const handle = (channel: IpcChannel, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, async (event, ...args) => {
      requireWindow(event)
      return fn(event, ...args)
    })
  }

  const { store } = ctx

  // applications
  handle(IPC.listApplications, () => store.listApplications())
  handle(IPC.getApplication, (_e, id) => store.getApplication(assertId(id)))
  handle(IPC.addApplication, (_e, input) => addApplication(store, input))
  handle(IPC.updateApplication, (_e, id, input) => updateApplication(store, assertId(id), input))
  handle(IPC.removeApplications, (_e, ids) => removeApplications(store, ids))
  handle(IPC.restoreApplications, (_e, ids) => restoreApplications(store, ids))
  handle(IPC.bulkUpdateApplications, (_e, ids, patch) => bulkUpdateApplications(store, ids, patch))
  handle(IPC.setFavorite, (_e, id, favorite) => store.setFavorite(assertId(id), Boolean(favorite)))
  handle(IPC.launchApplication, (_e, id) => launchApplication(store, assertId(id)))
  handle(IPC.refreshIcons, () => refreshIcons(store))
  handle(IPC.checkAllTargets, () => checkAllTargets(store))
  handle(IPC.checkApplicationTarget, async (_e, id) => {
    const application = store.getApplication(assertId(id))
    if (!application) return { exists: false, message: 'This entry no longer exists.' }
    return checkTarget(application)
  })

  // files the user explicitly picks
  handle(IPC.chooseApplicationFile, (e) => chooseApplicationFile(requireWindow(e)))
  handle(IPC.readDroppedFileMetadata, (_e, filePath) => readDroppedFileMetadata(filePath))
  handle(IPC.chooseCoverImage, (e) => chooseCoverImage(requireWindow(e)))
  handle(IPC.importCoverFromPath, (_e, filePath) => importDroppedCover(filePath))
  handle(IPC.importCoverFromBytes, (_e, bytes) => importCoverFromBytes(bytes))

  // platforms / categories
  const labelInput = (raw: unknown): { id?: string; name: string } => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid input.')
    const r = raw as Record<string, unknown>
    return { id: r.id === undefined || r.id === null ? undefined : assertId(r.id), name: validateLabel(r.name) }
  }
  handle(IPC.listPlatforms, () => store.listLabels('platforms'))
  handle(IPC.savePlatform, (_e, raw) => store.saveLabel('platforms', labelInput(raw)))
  handle(IPC.removePlatform, (_e, id) => store.deleteLabel('platforms', assertId(id)))
  handle(IPC.reorderPlatforms, (_e, ids) => store.reorderLabels('platforms', assertIdList(ids)))
  handle(IPC.listCategories, () => store.listLabels('categories'))
  handle(IPC.saveCategory, (_e, raw) => store.saveLabel('categories', labelInput(raw)))
  handle(IPC.removeCategory, (_e, id) => store.deleteLabel('categories', assertId(id)))
  handle(IPC.reorderCategories, (_e, ids) => store.reorderLabels('categories', assertIdList(ids)))

  // picker presets
  handle(IPC.listPresets, () => store.listPresets())
  handle(IPC.savePreset, (_e, raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid input.')
    const r = raw as Record<string, unknown>
    return store.savePreset({
      id: r.id === undefined || r.id === null ? undefined : assertId(r.id),
      name: validateLabel(r.name),
      applicationIds: assertIdList(r.applicationIds)
    })
  })
  handle(IPC.deletePreset, (_e, id) => store.deletePreset(assertId(id)))

  // backup
  handle(IPC.exportBackup, (e) => exportBackup(requireWindow(e), store))
  handle(IPC.inspectBackup, (e) => inspectBackup(requireWindow(e)))
  handle(IPC.importBackup, (_e, token, mode) => importBackup(store, token, mode))

  // misc
  handle(IPC.getAppInfo, (): AppInfo => ({ version: app.getVersion(), dataDir: getPaths().dataDir }))
  handle(IPC.openDataFolder, () => openDataFolder())
  handle(IPC.setTitleBarColors, (e, color, symbolColor) => {
    const HEX = /^#[0-9a-f]{6}$/i
    if (typeof color !== 'string' || typeof symbolColor !== 'string' || !HEX.test(color) || !HEX.test(symbolColor)) {
      throw new Error('Invalid colour.')
    }
    requireWindow(e).setTitleBarOverlay({ color, symbolColor, height: TITLEBAR_HEIGHT })
  })
  handle(IPC.minimizeWindow, (e) => requireWindow(e).minimize())
}
