import { shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Application, LaunchResult, TargetStatus } from '../shared/types'
import type { Store } from './db'
import { validateLaunchTarget } from './validate'

/**
 * Safety Rules 1 + 2 live here.
 *
 *  - The UI hands over an application ID; the path comes from our own database.
 *  - The target is re-validated against the allowlist before anything runs.
 *  - .exe  -> CreateProcess directly (spawn with shell:false, no arguments),
 *             with the working directory set to the exe's own folder.
 *             If Windows refuses (e.g. the app needs UAC), fall back to the
 *             same call Explorer makes on double-click (shell.openPath).
 *  - .lnk  -> shell.openPath: Windows resolves the shortcut exactly like a
 *             double-click, honouring the shortcut's own arguments and folder.
 *  - links -> shell.openExternal, only for allowlisted schemes.
 *
 * No command string is ever assembled and no shell is ever involved.
 */

async function fileExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(p)
    return stat.isFile()
  } catch {
    return false
  }
}

export async function checkTarget(app: Application): Promise<TargetStatus> {
  const v = validateLaunchTarget(app.launchType, app.launchTarget)
  if (!v.ok) return { exists: false, message: v.message }
  if (app.launchType === 'uri') return { exists: true }

  if (!(await fileExists(app.launchTarget))) {
    return { exists: false, message: 'Launch target could not be found.' }
  }
  if (app.launchType === 'shortcut') {
    // Read-only peek at where the shortcut points so we can warn before Windows does.
    try {
      const link = shell.readShortcutLink(app.launchTarget)
      const target = link.target
      if (target && path.isAbsolute(target) && !fs.existsSync(target)) {
        return { exists: false, message: `The shortcut points to a file that no longer exists:\n${target}` }
      }
    } catch {
      // Some shortcuts (e.g. Store/MSI advertised ones) cannot be parsed; trust Windows to launch them.
    }
  }
  return { exists: true }
}

function spawnDetached(exePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: false
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export async function launchApplication(store: Store, id: string): Promise<LaunchResult> {
  const app = store.getApplication(id)
  if (!app) return { ok: false, code: 'invalid', message: 'This entry no longer exists.' }

  const v = validateLaunchTarget(app.launchType, app.launchTarget)
  if (!v.ok) return { ok: false, code: 'invalid', message: v.message }

  const status = await checkTarget(app)
  if (!status.exists) return { ok: false, code: 'missing', message: status.message ?? 'Launch target could not be found.' }

  try {
    if (app.launchType === 'uri') {
      await shell.openExternal(app.launchTarget)
    } else if (app.launchType === 'executable') {
      try {
        await spawnDetached(app.launchTarget)
      } catch {
        const err = await shell.openPath(app.launchTarget)
        if (err) return { ok: false, code: 'os_error', message: `Windows could not open this application.\n${err}` }
      }
    } else {
      const err = await shell.openPath(app.launchTarget)
      if (err) return { ok: false, code: 'os_error', message: `Windows could not open this shortcut.\n${err}` }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'os_error', message: `Windows could not open this application.\n${message}` }
  }

  store.markLaunched(id)
  return { ok: true }
}
