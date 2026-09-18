export const IPC = {
  listApplications: 'apps:list',
  getApplication: 'apps:get',
  addApplication: 'apps:add',
  updateApplication: 'apps:update',
  removeApplication: 'apps:remove',
  setFavorite: 'apps:favorite',
  launchApplication: 'apps:launch',
  checkApplicationTarget: 'apps:checkTarget',
  refreshIcons: 'apps:refreshIcons',

  chooseApplicationFile: 'files:chooseApplication',
  readDroppedFileMetadata: 'files:droppedMetadata',
  chooseCoverImage: 'files:chooseCover',

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
  openDataFolder: 'app:openDataFolder'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
