export type Ecosystem = 'npm' | 'pypi'

// What the registry said about one package. `exists: null` means the lookup failed.
export type Lookup = {
  eco: Ecosystem
  name: string
  exists: boolean | null
  createdMs?: number
  // Weekly downloads; absent when the stats service did not answer.
  weekly?: number
  latest?: string
  deprecated?: string
  // Every published version (npm) or release (PyPI), newest last; capped.
  versions?: string[]
  distTags?: Record<string, string>
  // npm versions that run preinstall/install/postinstall, with which scripts.
  scripted?: Record<string, string[]>
  // PyPI releases that ship no wheel, so a build script runs on install.
  sdistOnly?: string[]
  // PyPI releases that have an sdist at all (built from source under --no-binary).
  withSdist?: string[]
  at: number
}

export type Check = { name: string; eco: Ecosystem; level: 'high' | 'medium' | 'ok'; reasons: string[] }

declare module 'claude-code' {
  interface PluginState {
    'dependency-bouncer': {
      cache: Record<string, Lookup>
      allowed: string[]
      last: Check[] | null
    }
  }
}
