import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc'
import type { LauncherApi } from '../shared/types'

/**
 * The narrow bridge between the UI and the main process. The renderer gets
 * exactly these functions and nothing else: no Node, no filesystem, no shell.
 */
const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args)

const api: LauncherApi = {
  listApplications: () => invoke(IPC.listApplications),
  getApplication: (id) => invoke(IPC.getApplication, id),
  addApplication: (input) => invoke(IPC.addApplication, input),
  updateApplication: (id, input) => invoke(IPC.updateApplication, id, input),
  removeApplication: (id) => invoke(IPC.removeApplication, id),
  setFavorite: (id, favorite) => invoke(IPC.setFavorite, id, favorite),
  launchApplication: (id) => invoke(IPC.launchApplication, id),
  checkApplicationTarget: (id) => invoke(IPC.checkApplicationTarget, id),
  refreshIcons: () => invoke(IPC.refreshIcons),

  chooseApplicationFile: () => invoke(IPC.chooseApplicationFile),
  readDroppedFileMetadata: (path) => invoke(IPC.readDroppedFileMetadata, path),
  chooseCoverImage: () => invoke(IPC.chooseCoverImage),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  listPlatforms: () => invoke(IPC.listPlatforms),
  savePlatform: (input) => invoke(IPC.savePlatform, input),
  removePlatform: (id) => invoke(IPC.removePlatform, id),
  reorderPlatforms: (ids) => invoke(IPC.reorderPlatforms, ids),
  listCategories: () => invoke(IPC.listCategories),
  saveCategory: (input) => invoke(IPC.saveCategory, input),
  removeCategory: (id) => invoke(IPC.removeCategory, id),
  reorderCategories: (ids) => invoke(IPC.reorderCategories, ids),

  listPresets: () => invoke(IPC.listPresets),
  savePreset: (input) => invoke(IPC.savePreset, input),
  deletePreset: (id) => invoke(IPC.deletePreset, id),

  exportBackup: () => invoke(IPC.exportBackup),
  inspectBackup: () => invoke(IPC.inspectBackup),
  importBackup: (token, mode) => invoke(IPC.importBackup, token, mode),

  getAppInfo: () => invoke(IPC.getAppInfo),
  openDataFolder: () => invoke(IPC.openDataFolder)
}

contextBridge.exposeInMainWorld('launcher', api)
