export const IPC = {
  listApplications: 'apps:list',
  getApplication: 'apps:get',
  addApplication: 'apps:add',
  updateApplication: 'apps:update',
  removeApplications: 'apps:remove',
  restoreApplications: 'apps:restore',
  bulkUpdateApplications: 'apps:bulkUpdate',
  setFavorite: 'apps:favorite',
  launchApplication: 'apps:launch',
  checkApplicationTarget: 'apps:checkTarget',
  refreshIcons: 'apps:refreshIcons',
  checkAllTargets: 'apps:checkAllTargets',

  chooseApplicationFile: 'files:chooseApplication',
  readDroppedFileMetadata: 'files:droppedMetadata',
  chooseCoverImage: 'files:chooseCover',
  importCoverFromPath: 'files:importCoverPath',
  importCoverFromBytes: 'files:importCoverBytes',

  listPlatforms: 'platforms:list',
  savePlatform: 'platforms:save',
  removePlatform: 'platforms:remove',
  reorderPlatforms: 'platforms:reorder',
  listCategories: 'categories:list',
  saveCategory: 'categories:save',
  removeCategory: 'categories:remove',
  reorderCategories: 'categories:reorder',

  listPresets: 'presets:list',
  savePreset: 'presets:save',
  deletePreset: 'presets:delete',

  exportBackup: 'backup:export',
  inspectBackup: 'backup:inspect',
  importBackup: 'backup:import',

  getAppInfo: 'app:info',
  openDataFolder: 'app:openDataFolder',
  setTitleBarColors: 'app:titleBarColors',
  minimizeWindow: 'app:minimize'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
