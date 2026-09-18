import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import type { Application, Category, PickerPreset, Platform } from '../shared/types'

/**
 * SQLite via sql.js (WebAssembly). The whole database lives in memory and is
 * written back to disk atomically (write temp file, then rename) after every
 * committed transaction, so a crash can never leave a half-written file.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platforms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS applications (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  launch_type              TEXT NOT NULL CHECK (launch_type IN ('executable', 'shortcut', 'uri')),
  launch_target            TEXT NOT NULL,
  launch_target_normalized TEXT NOT NULL UNIQUE,
  cover_path               TEXT,
  icon_path                TEXT,
  platform_id              TEXT REFERENCES platforms(id) ON DELETE SET NULL,
  category_id              TEXT REFERENCES categories(id) ON DELETE SET NULL,
  favorite                 INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  last_launched_at         TEXT,
  launch_count             INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS picker_presets (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS picker_preset_items (
  preset_id      TEXT NOT NULL REFERENCES picker_presets(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  PRIMARY KEY (preset_id, application_id)
);
`

const SCHEMA_VERSION = 2
const DEFAULT_PLATFORMS = ['Steam', 'Epic', 'Riot', 'Xbox', 'Standalone', 'Other']
const DEFAULT_CATEGORIES = ['Game', 'Development', 'University', 'Utility', 'Media', 'Other']

interface ApplicationRow {
  id: string
  name: string
  launch_type: Application['launchType']
  launch_target: string
  launch_target_normalized: string
  cover_path: string | null
  icon_path: string | null
  platform_id: string | null
  category_id: string | null
  favorite: number
  created_at: string
  updated_at: string
  last_launched_at: string | null
  launch_count: number
}

interface LabelRow {
  id: string
  name: string
  sort_order: number
}

export type LabelTable = 'platforms' | 'categories'

export interface NewApplication {
  name: string
  launchType: Application['launchType']
  launchTarget: string
  normalized: string
  coverPath: string | null
  iconPath: string | null
  platformId: string | null
  categoryId: string | null
  favorite: boolean
  createdAt?: string
  updatedAt?: string
  lastLaunchedAt?: string | null
  launchCount?: number
}

const now = (): string => new Date().toISOString()

function rowToApplication(r: ApplicationRow): Application {
  return {
    id: r.id,
    name: r.name,
    launchType: r.launch_type,
    launchTarget: r.launch_target,
    coverPath: r.cover_path,
    iconPath: r.icon_path,
    platformId: r.platform_id,
    categoryId: r.category_id,
    favorite: r.favorite === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastLaunchedAt: r.last_launched_at,
    launchCount: r.launch_count ?? 0
  }
}

const rowToLabel = (r: LabelRow): Platform => ({ id: r.id, name: r.name, sortOrder: r.sort_order })

export class Store {
  private txDepth = 0

  private constructor(
    private db: Database,
    private readonly file: string
  ) {}

  static async open(file: string): Promise<Store> {
    const SQL = await initSqlJs()
    const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database()
    const store = new Store(db, file)
    store.afterOpen()
    store.migrate()
    return store
  }

  /** PRAGMAs are per-connection and sql.js reopens on export, so re-apply them. */
  private afterOpen(): void {
    this.db.run('PRAGMA foreign_keys = ON')
  }

  private persist(): void {
    const bytes = this.db.export() // note: closes + reopens the in-memory db
    this.afterOpen()
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, Buffer.from(bytes))
    fs.renameSync(tmp, this.file)
  }

  private migrate(): void {
    this.db.exec(SCHEMA)
    const version = Number(this.get<{ value: string }>(`SELECT value FROM meta WHERE key = 'schema_version'`)?.value ?? 0)
    if (version === 0) {
      // Fresh database: seed defaults. SCHEMA above is already the current shape.
      this.transaction(() => {
        DEFAULT_PLATFORMS.forEach((name, i) =>
          this.run('INSERT INTO platforms (id, name, sort_order) VALUES (?, ?, ?)', [randomUUID(), name, i])
        )
        DEFAULT_CATEGORIES.forEach((name, i) =>
          this.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [randomUUID(), name, i])
        )
        this.run(`INSERT INTO meta (key, value) VALUES ('schema_version', ?)`, [String(SCHEMA_VERSION)])
      })
      return
    }
    if (version < 2) {
      this.transaction(() => {
        if (!this.hasColumn('applications', 'launch_count')) {
          this.run('ALTER TABLE applications ADD COLUMN launch_count INTEGER NOT NULL DEFAULT 0')
        }
        this.run(`UPDATE meta SET value = '2' WHERE key = 'schema_version'`)
      })
    }
  }

  private hasColumn(table: string, column: string): boolean {
    return this.all<{ name: string }>(`PRAGMA table_info(${table})`).some((c) => c.name === column)
  }

  schemaVersion(): number {
    return Number(this.get<{ value: string }>(`SELECT value FROM meta WHERE key = 'schema_version'`)?.value ?? 0)
  }

  // ---- low level -----------------------------------------------------------

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } finally {
      stmt.free()
    }
  }

  get<T>(sql: string, params: SqlValue[] = []): T | null {
    return this.all<T>(sql, params)[0] ?? null
  }

  run(sql: string, params: SqlValue[] = []): void {
    this.db.run(sql, params)
  }

  /** Runs fn atomically and persists to disk once the outermost transaction commits. */
  transaction<T>(fn: () => T): T {
    if (this.txDepth > 0) return fn()
    this.txDepth++
    this.db.run('BEGIN')
    try {
      const result = fn()
      this.db.run('COMMIT')
      this.txDepth--
      this.persist()
      return result
    } catch (err) {
      this.db.run('ROLLBACK')
      this.txDepth--
      throw err
    }
  }

  // ---- applications --------------------------------------------------------

  listApplications(): Application[] {
    return this.all<ApplicationRow>('SELECT * FROM applications ORDER BY name COLLATE NOCASE').map(rowToApplication)
  }

  getApplication(id: string): Application | null {
    const row = this.get<ApplicationRow>('SELECT * FROM applications WHERE id = ?', [id])
    return row ? rowToApplication(row) : null
  }

  findByNormalizedTarget(normalized: string): Application | null {
    const row = this.get<ApplicationRow>('SELECT * FROM applications WHERE launch_target_normalized = ?', [normalized])
    return row ? rowToApplication(row) : null
  }

  insertApplication(input: NewApplication): Application {
    const id = randomUUID()
    const ts = now()
    this.transaction(() => {
      this.run(
        `INSERT INTO applications
          (id, name, launch_type, launch_target, launch_target_normalized, cover_path, icon_path,
           platform_id, category_id, favorite, created_at, updated_at, last_launched_at, launch_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.launchType,
          input.launchTarget,
          input.normalized,
          input.coverPath,
          input.iconPath,
          this.existingId('platforms', input.platformId),
          this.existingId('categories', input.categoryId),
          input.favorite ? 1 : 0,
          input.createdAt ?? ts,
          input.updatedAt ?? ts,
          input.lastLaunchedAt ?? null,
          Math.max(0, Math.floor(input.launchCount ?? 0))
        ]
      )
    })
    return this.getApplication(id)!
  }

  updateApplication(id: string, input: NewApplication): Application {
    this.transaction(() => {
      this.run(
        `UPDATE applications SET
           name = ?, launch_type = ?, launch_target = ?, launch_target_normalized = ?,
           cover_path = ?, icon_path = ?, platform_id = ?, category_id = ?, favorite = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.name,
          input.launchType,
          input.launchTarget,
          input.normalized,
          input.coverPath,
          input.iconPath,
          this.existingId('platforms', input.platformId),
          this.existingId('categories', input.categoryId),
          input.favorite ? 1 : 0,
          now(),
          id
        ]
      )
    })
    return this.getApplication(id)!
  }

  /** Removes the launcher entry only. Returns the removed record so owned assets can be cleaned up. */
  deleteApplication(id: string): Application | null {
    const existing = this.getApplication(id)
    if (!existing) return null
    this.transaction(() => this.run('DELETE FROM applications WHERE id = ?', [id]))
    return existing
  }

  setFavorite(id: string, favorite: boolean): void {
    this.transaction(() =>
      this.run('UPDATE applications SET favorite = ?, updated_at = ? WHERE id = ?', [favorite ? 1 : 0, now(), id])
    )
  }

  markLaunched(id: string): void {
    this.transaction(() =>
      this.run('UPDATE applications SET last_launched_at = ?, launch_count = launch_count + 1 WHERE id = ?', [now(), id])
    )
  }

  private existingId(table: LabelTable, id: string | null): string | null {
    if (!id) return null
    return this.get<{ id: string }>(`SELECT id FROM ${table} WHERE id = ?`, [id])?.id ?? null
  }

  // ---- platforms / categories ---------------------------------------------

  listLabels(table: LabelTable): Platform[] {
    return this.all<LabelRow>(`SELECT * FROM ${table} ORDER BY sort_order, name COLLATE NOCASE`).map(rowToLabel)
  }

  findLabelByName(table: LabelTable, name: string): Platform | null {
    const row = this.get<LabelRow>(`SELECT * FROM ${table} WHERE name = ? COLLATE NOCASE`, [name])
    return row ? rowToLabel(row) : null
  }

  saveLabel(table: LabelTable, input: { id?: string; name: string }): Platform | Category {
    if (input.id) {
      const id = input.id
      this.transaction(() => this.run(`UPDATE ${table} SET name = ? WHERE id = ?`, [input.name, id]))
      const row = this.get<LabelRow>(`SELECT * FROM ${table} WHERE id = ?`, [id])
      if (!row) throw new Error('Not found.')
      return rowToLabel(row)
    }
    const id = randomUUID()
    this.transaction(() => {
      const max = this.get<{ m: number | null }>(`SELECT MAX(sort_order) AS m FROM ${table}`)?.m ?? -1
      this.run(`INSERT INTO ${table} (id, name, sort_order) VALUES (?, ?, ?)`, [id, input.name, max + 1])
    })
    return rowToLabel(this.get<LabelRow>(`SELECT * FROM ${table} WHERE id = ?`, [id])!)
  }

  /** Applications keep existing; their reference becomes NULL (ON DELETE SET NULL). */
  deleteLabel(table: LabelTable, id: string): void {
    this.transaction(() => this.run(`DELETE FROM ${table} WHERE id = ?`, [id]))
  }

  reorderLabels(table: LabelTable, ids: string[]): void {
    this.transaction(() => {
      ids.forEach((id, i) => this.run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [i, id]))
    })
  }

  // ---- picker presets ------------------------------------------------------

  listPresets(): PickerPreset[] {
    const presets = this.all<{ id: string; name: string; created_at: string; updated_at: string }>(
      'SELECT * FROM picker_presets ORDER BY name COLLATE NOCASE'
    )
    const items = this.all<{ preset_id: string; application_id: string }>('SELECT * FROM picker_preset_items')
    return presets.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      applicationIds: items.filter((i) => i.preset_id === p.id).map((i) => i.application_id)
    }))
  }

  findPresetByName(name: string): PickerPreset | null {
    return this.listPresets().find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null
  }

  savePreset(input: { id?: string; name: string; applicationIds: string[] }): PickerPreset {
    const id = input.id ?? randomUUID()
    const ts = now()
    this.transaction(() => {
      if (input.id) {
        this.run('UPDATE picker_presets SET name = ?, updated_at = ? WHERE id = ?', [input.name, ts, id])
        this.run('DELETE FROM picker_preset_items WHERE preset_id = ?', [id])
      } else {
        this.run('INSERT INTO picker_presets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
          id,
          input.name,
          ts,
          ts
        ])
      }
      for (const appId of new Set(input.applicationIds)) {
        if (this.getApplication(appId)) {
          this.run('INSERT INTO picker_preset_items (preset_id, application_id) VALUES (?, ?)', [id, appId])
        }
      }
    })
    const preset = this.listPresets().find((p) => p.id === id)
    if (!preset) throw new Error('Preset not found after save.')
    return preset
  }

  deletePreset(id: string): void {
    this.transaction(() => this.run('DELETE FROM picker_presets WHERE id = ?', [id]))
  }

  // ---- backup helpers ------------------------------------------------------

  /** Empties every user table inside the current transaction. Used by "Replace" restore. */
  clearAll(): void {
    this.run('DELETE FROM picker_preset_items')
    this.run('DELETE FROM picker_presets')
    this.run('DELETE FROM applications')
    this.run('DELETE FROM platforms')
    this.run('DELETE FROM categories')
  }
}
