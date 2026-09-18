import { app, shell } from 'electron'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { addApplication, refreshIcons, removeApplication, updateApplication } from './apps'
import { importBackup, loadBackupFile } from './backup'
import { Store } from './db'
import { cleanDisplayName, extractIcon, readDroppedFileMetadata } from './files'
import { extractLargestIcon } from './icons'
import { checkAllTargets, checkTarget } from './launch'
import { getPaths, resolveDataDir, resolveInsideAssets } from './paths'
import { validateLaunchTarget } from './validate'

/**
 * `electron . --smoke` — exercises the backend against a throwaway data folder
 * (SMOKE_DIR) and exits non-zero on the first failure. Nothing is launched and
 * nothing outside SMOKE_DIR is written.
 */
export async function runSmoke(): Promise<void> {
  const paths = getPaths()
  const results: string[] = []
  const ok = (label: string): void => {
    results.push(`ok   ${label}`)
  }

  // --- validators (Safety Rule 3) ---
  const notepad = 'C:\\Windows\\System32\\notepad.exe'
  assert.equal(validateLaunchTarget('executable', notepad).ok, true)
  assert.equal(validateLaunchTarget('executable', 'C:\\x\\setup.msi').ok, false)
  assert.equal(validateLaunchTarget('executable', 'C:\\x\\run.bat').ok, false)
  assert.equal(validateLaunchTarget('executable', 'C:\\x\\fix.reg').ok, false)
  assert.equal(validateLaunchTarget('executable', 'game.exe').ok, false)
  assert.equal(validateLaunchTarget('shortcut', 'C:\\x\\Game.LNK').ok, true)
  assert.equal(validateLaunchTarget('shortcut', 'C:\\x\\Game.exe').ok, false)
  assert.equal(validateLaunchTarget('uri', 'steam://rungameid/1145360').ok, true)
  assert.equal(validateLaunchTarget('uri', 'https://example.com').ok, true)
  assert.equal(validateLaunchTarget('uri', 'http://example.com').ok, false)
  assert.equal(validateLaunchTarget('uri', 'ms-msdt:/id PCWDiagnostic').ok, false)
  assert.equal(validateLaunchTarget('uri', 'file:///C:/Windows').ok, false)
  assert.equal(validateLaunchTarget('command' as never, 'cmd /c dir').ok, false)
  ok('validators accept only .exe/.lnk/steam/https')

  // --- data-folder rename migration (PersonalLauncher -> Launchpad) ---
  const fakeAppData = path.join(paths.dataDir, 'fake-appdata')
  fs.mkdirSync(path.join(fakeAppData, 'PersonalLauncher'), { recursive: true })
  fs.writeFileSync(path.join(fakeAppData, 'PersonalLauncher', 'launcher.db'), 'x')
  assert.equal(resolveDataDir(fakeAppData), path.join(fakeAppData, 'Launchpad'))
  assert.ok(fs.existsSync(path.join(fakeAppData, 'Launchpad', 'launcher.db')))
  assert.ok(!fs.existsSync(path.join(fakeAppData, 'PersonalLauncher')))
  assert.equal(resolveDataDir(fakeAppData), path.join(fakeAppData, 'Launchpad')) // idempotent
  fs.rmSync(fakeAppData, { recursive: true, force: true })
  ok('legacy data folder is renamed in place, once')

  // --- asset path guard (Safety Rule 4) ---
  assert.equal(resolveInsideAssets('../launcher.db'), null)
  assert.equal(resolveInsideAssets('C:\\Windows\\x.png'), null)
  assert.equal(resolveInsideAssets('..\\..\\x.png'), null)
  assert.equal(resolveInsideAssets('notauuid.png'), null)
  const good = resolveInsideAssets('123e4567-e89b-12d3-a456-426614174000.png')
  assert.ok(good && path.dirname(good) === path.resolve(paths.assetsDir))
  ok('asset filenames cannot escape the assets folder')

  // --- names ---
  assert.equal(cleanDisplayName('MinecraftLauncher'), 'Minecraft Launcher')
  assert.equal(cleanDisplayName('Hades'), 'Hades')
  assert.equal(cleanDisplayName('stardew_valley'), 'Stardew Valley')
  assert.equal(cleanDisplayName('GTAV'), 'GTAV')
  ok('display-name cleanup is conservative')

  // --- dropped file metadata is read-only and type-checked ---
  const meta = await readDroppedFileMetadata(notepad)
  assert.ok(meta && meta.launchType === 'executable' && meta.suggestedName === 'Notepad')
  assert.equal(await readDroppedFileMetadata('C:\\Windows'), null) // a folder
  assert.equal(await readDroppedFileMetadata('C:\\Windows\\win.ini'), null) // wrong type
  assert.equal(await readDroppedFileMetadata('relative.exe'), null)
  ok('dropped-file metadata refuses folders and unsupported types')

  // --- Steam-style .url shortcuts: the URL inside must pass the same allowlist ---
  const urlFile = path.join(paths.dataDir, 'Hades.url')
  fs.writeFileSync(urlFile, '[InternetShortcut]\r\nURL=steam://rungameid/1145360\r\nIconFile=C:\\nowhere.ico\r\n')
  const urlMeta = await readDroppedFileMetadata(urlFile)
  assert.ok(urlMeta && urlMeta.launchType === 'uri' && urlMeta.launchTarget === 'steam://rungameid/1145360')
  assert.equal(urlMeta.suggestedName, 'Hades')
  const badUrlFile = path.join(paths.dataDir, 'Evil.url')
  fs.writeFileSync(badUrlFile, '[InternetShortcut]\r\nURL=ms-msdt:/id PCWDiagnostic\r\n')
  assert.equal(await readDroppedFileMetadata(badUrlFile), null)
  fs.writeFileSync(badUrlFile, '[InternetShortcut]\r\nURL=file:///C:/Windows/System32/cmd.exe\r\n')
  assert.equal(await readDroppedFileMetadata(badUrlFile), null)
  fs.unlinkSync(badUrlFile)
  ok('.url shortcuts accepted only with steam:// or https:// inside')

  // --- store ---
  const store = await Store.open(paths.dbFile)
  assert.equal(store.listLabels('platforms').length, 6)
  assert.equal(store.listLabels('categories').length, 6)
  ok('fresh database seeded with default platforms/categories')

  const steam = store.findLabelByName('platforms', 'steam')!
  const added = await addApplication(store, {
    name: '  Notepad  ',
    launchType: 'executable',
    launchTarget: notepad,
    platformId: steam.id,
    favorite: true
  })
  assert.ok(added.ok)
  const notepadApp = added.application
  assert.equal(notepadApp.name, 'Notepad')
  assert.ok(notepadApp.iconPath && fs.existsSync(resolveInsideAssets(notepadApp.iconPath)!))
  ok('add application stores entry and extracts its icon into assets')

  // --- icon extraction reads the file's own resources (larger than the 32px Explorer icon) ---
  const pngSize = (file: string): number => fs.readFileSync(resolveInsideAssets(file)!).readUInt32BE(16)
  assert.ok(pngSize(notepadApp.iconPath) >= 48, `expected a large icon, got ${pngSize(notepadApp.iconPath)}px`)
  const lnkFile = path.join(paths.dataDir, 'np.lnk')
  assert.ok(shell.writeShortcutLink(lnkFile, { target: notepad })) // test fixture inside our own folder
  const lnkIcon = await extractIcon(lnkFile)
  assert.ok(lnkIcon && pngSize(lnkIcon) >= 48)
  const urlIconFile = path.join(paths.dataDir, 'WithIcon.url')
  fs.writeFileSync(urlIconFile, `[InternetShortcut]\r\nURL=https://example.com\r\nIconFile=${notepad}\r\nIconIndex=0\r\n`)
  const urlIcon = await extractIcon(urlIconFile)
  assert.ok(urlIcon && pngSize(urlIcon) >= 48)
  const garbage = path.join(paths.dataDir, 'garbage.exe')
  fs.writeFileSync(garbage, Buffer.from('MZ this is not really a program'))
  assert.equal(await extractLargestIcon(garbage), null)
  for (const f of [lnkFile, urlIconFile, garbage]) fs.unlinkSync(f)
  assert.equal(await refreshIcons(store), 1)
  ok('largest icon extracted from exe / lnk / url resources; malformed files ignored')

  const dup = await addApplication(store, { name: 'Again', launchType: 'executable', launchTarget: notepad.toUpperCase() })
  assert.ok(!dup.ok && dup.reason === 'duplicate' && dup.existing.id === notepadApp.id)
  ok('duplicate target detected case-insensitively')

  const bad = await addApplication(store, { name: 'Bad', launchType: 'executable', launchTarget: 'C:\\x\\evil.bat' })
  assert.ok(!bad.ok && bad.reason === 'invalid')
  ok('invalid target rejected on save')

  assert.equal((await checkTarget(notepadApp)).exists, true)
  const missing = await addApplication(store, { name: 'Gone', launchType: 'executable', launchTarget: 'C:\\definitely\\not\\here.exe' })
  assert.ok(missing.ok)
  assert.equal((await checkTarget(missing.application)).exists, false)
  ok('target existence check')

  // --- foreign keys survive persist() (sql.js reopens on export) ---
  store.deleteLabel('platforms', steam.id)
  assert.equal(store.getApplication(notepadApp.id)!.platformId, null)
  ok('removing a platform nulls references instead of removing apps')

  const preset = store.savePreset({ name: 'Chill', applicationIds: [notepadApp.id, missing.application.id] })
  assert.equal(preset.applicationIds.length, 2)
  await removeApplication(store, missing.application.id)
  assert.equal(store.listPresets()[0].applicationIds.length, 1)
  assert.equal(store.getApplication(missing.application.id), null)
  ok('remove from library cascades out of presets')

  const edited = await updateApplication(store, notepadApp.id, {
    name: 'Notepad (renamed)',
    launchType: 'executable',
    launchTarget: notepad,
    coverPath: '../../launcher.db',
    favorite: false
  })
  assert.ok(edited.ok && edited.application.coverPath === null && edited.application.name === 'Notepad (renamed)')
  ok('edit ignores cover paths that are not launcher assets')

  // --- launch count + missing-target audit ---
  store.markLaunched(notepadApp.id)
  store.markLaunched(notepadApp.id)
  assert.equal(store.getApplication(notepadApp.id)!.launchCount, 2)
  const gone = await addApplication(store, { name: 'Gone Again', launchType: 'executable', launchTarget: 'C:\\definitely\\not\\here2.exe' })
  assert.ok(gone.ok)
  const audit = await checkAllTargets(store)
  assert.deepEqual(audit.map((m) => m.id), [gone.application.id])
  await removeApplication(store, gone.application.id)
  ok('launch count increments; audit lists only missing targets')

  // --- persistence: reopen from disk ---
  const reopened = await Store.open(paths.dbFile)
  assert.equal(reopened.listApplications().length, 1)
  assert.equal(reopened.listPresets().length, 1)
  assert.ok(!fs.existsSync(`${paths.dbFile}.tmp`))
  ok('database persisted atomically and reopens')

  // --- schema migration from v1 (no launch_count column) ---
  reopened.transaction(() => {
    reopened.run('ALTER TABLE applications DROP COLUMN launch_count')
    reopened.run(`UPDATE meta SET value = '1' WHERE key = 'schema_version'`)
  })
  const migrated = await Store.open(paths.dbFile)
  assert.equal(migrated.schemaVersion(), 2)
  assert.equal(migrated.getApplication(notepadApp.id)!.launchCount, 0)
  migrated.markLaunched(notepadApp.id)
  assert.equal(migrated.getApplication(notepadApp.id)!.launchCount, 1)
  ok('v1 database migrates to v2 in place')

  // --- backup import treats the file as untrusted ---
  const backupFile = path.join(paths.dataDir, 'test-backup.json')
  fs.writeFileSync(
    backupFile,
    JSON.stringify({
      version: 1,
      platforms: [{ id: 'p1', name: 'Epic' }, { id: 'p2', name: 'Custom Box' }],
      categories: [{ id: 'c1', name: 'Game' }],
      applications: [
        { id: 'a1', name: 'Calc', launchType: 'executable', launchTarget: 'C:\\Windows\\System32\\calc.exe', platformId: 'p2', categoryId: 'c1' },
        { id: 'a2', name: 'Evil', launchType: 'executable', launchTarget: 'C:\\evil\\payload.bat' },
        { id: 'a3', name: 'Follina', launchType: 'uri', launchTarget: 'ms-msdt:/id PCWDiagnostic' },
        { id: 'a4', name: 'Dup', launchType: 'executable', launchTarget: notepad },
        { id: 'a5', name: 'Traversal', launchType: 'executable', launchTarget: 'C:\\Windows\\System32\\cmd.exe', coverPath: '..\\..\\launcher.db' }
      ],
      pickerPresets: [{ id: 'x', name: 'Imported', applicationIds: ['a1', 'a2', 'a4', 'a5'] }]
    })
  )
  const summary = await loadBackupFile(backupFile)
  assert.equal(summary.applications, 5)
  const restored = await importBackup(migrated, summary.token, 'merge')
  assert.equal(restored.imported.applications, 2) // calc + cmd; bat, follina rejected; notepad already present
  assert.equal(restored.imported.platforms, 1) // Epic existed, Custom Box new
  assert.equal(restored.skipped, 3)
  const cmdApp = migrated.listApplications().find((a) => a.name === 'Traversal')!
  assert.equal(cmdApp.coverPath, null)
  const imported = migrated.listPresets().find((p) => p.name === 'Imported')!
  assert.equal(imported.applicationIds.length, 3) // a1, a4 (mapped to notepad), a5
  ok('backup import validates every entry and remaps ids')

  const summary2 = await loadBackupFile(backupFile)
  await importBackup(migrated, summary2.token, 'replace')
  assert.equal(fs.readdirSync(paths.snapshotsDir).length, 1)
  assert.equal(migrated.listApplications().length, 3)
  ok('replace restore snapshots the database first')

  // --- nothing escaped the data folder ---
  for (const f of fs.readdirSync(paths.assetsDir)) assert.match(f, /^[0-9a-f-]{36}\.png$/)
  ok('only launcher-generated files exist in assets')

  // Leave behind a small demo library (with icons, a favorite and launch history) so the
  // data folder can be opened with --data-dir for screenshots and manual poking.
  const demo = await addApplication(migrated, {
    name: 'File Explorer',
    launchType: 'executable',
    launchTarget: 'C:\\Windows\\explorer.exe',
    platformId: migrated.findLabelByName('platforms', 'Standalone')?.id ?? null,
    categoryId: migrated.findLabelByName('categories', 'Utility')?.id ?? null,
    favorite: true
  })
  assert.ok(demo.ok)
  migrated.markLaunched(demo.application.id)
  const steamDemo = await addApplication(migrated, {
    name: 'Hades',
    launchType: 'uri',
    launchTarget: 'steam://rungameid/1145360',
    iconPath: urlMeta.iconPath,
    platformId: migrated.findLabelByName('platforms', 'Epic')?.id ?? null,
    categoryId: migrated.findLabelByName('categories', 'Game')?.id ?? null
  })
  assert.ok(steamDemo.ok && steamDemo.application.launchType === 'uri')
  fs.unlinkSync(urlFile)
  fs.unlinkSync(backupFile)

  console.log(results.join('\n'))
  console.log(`\nSMOKE PASSED (${results.length} checks) in ${paths.dataDir}`)
  console.log(`demo-app-id=${demo.application.id}`)
}

export function isSmokeRun(): boolean {
  return process.argv.includes('--smoke')
}

export async function smokeMain(): Promise<never> {
  try {
    await runSmoke()
    app.exit(0)
  } catch (err) {
    console.error('SMOKE FAILED')
    console.error(err)
    app.exit(1)
  }
  return new Promise<never>(() => {})
}
