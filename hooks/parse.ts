import type { Ecosystem } from '../types'

// Where an install will fetch from when it is not the public registry.
export type Registry = { url: string; isExtra: boolean }

// One package a call would fetch. `remote` is code from a URL or git, not a registry.
export type Wanted = {
  eco: Ecosystem
  name: string
  spec: string
  via: string
  remote?: string
  registry?: Registry
  ignoreScripts?: boolean
  // The directory the install runs in, for .npmrc and lockfiles; '' is the session's.
  dir?: string
  // Where npm reads extra config from (`--userconfig`).
  userconfig?: string
  // pip was told to build from source (`--no-binary`), so any sdist's build script runs.
  sourceBuild?: boolean
  // The command named the public registry outright: config files can't redirect it.
  publicExplicit?: boolean
  // Which pip invocation asked for it: requirements-file index options apply per invocation.
  group?: number
}

// Public registries: naming them explicitly is not a custom registry.
export const isPublicRegistry = (url: string) =>
  /^https?:\/\/(registry\.npmjs\.org|registry\.yarnpkg\.com|pypi\.org\/simple|pypi\.python\.org\/simple)\/?$/i.test(url.trim())

// `~` and `~/x` against the user's home, when known.
let HOME = ''
export const useHome = (home: string) => {
  HOME = home
}
const tilde = (path: string) => (HOME !== '' && (path === '~' || path.startsWith('~/')) ? HOME + path.slice(1) : path)

// PEP 503: PyPI treats runs of -, _ and . as one separator, case-insensitively.
export const normalizePypi = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-')

const NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i
const PYPI_NAME = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/i
const LOCAL = /^(\.{1,2}(\/|$)|\/|~|file:|link:|workspace:|portal:)/
const REMOTE_PREFIX = /^(git\+|git:|git@|https?:|github:|gitlab:|bitbucket:|gist:)/i
const REMOTE_SHAPE = /^[\w-]+\/[\w.-]+(#.*)?$/
const ARCHIVE = /\.(tgz|tar\.gz|tar|whl|zip)(\?.*)?$/i
const REMOTE = { test: (s: string) => REMOTE_PREFIX.test(s) || REMOTE_SHAPE.test(s) || (ARCHIVE.test(s) && s.includes('://')) }

type Parsed = { name: string; spec: string; remote?: string } | null

// `pkg`, `pkg@1.2.3`, `@scope/pkg@^2`, `alias@npm:real@1`, `pkg@git+https://…`.
export function parseNpm(raw: string): Parsed {
  const spec = raw.trim()
  if (spec === '' || LOCAL.test(spec)) return null
  if (REMOTE_PREFIX.test(spec)) return { name: '', spec: '', remote: spec }
  // A name first, so `react@https://…/x.tgz` keeps the name it claims.
  const at = spec.indexOf('@', spec.startsWith('@') ? 1 : 0)
  const name = at > 0 ? spec.slice(0, at) : spec
  const rest = at > 0 ? spec.slice(at + 1) : ''
  if (at < 0 && REMOTE_SHAPE.test(spec)) return { name: '', spec: '', remote: spec }
  // `npm i foo.tgz` installs a local tarball file.
  if (at < 0 && ARCHIVE.test(spec)) return null
  if (!NPM_NAME.test(name)) return null
  return npmTarget(name.toLowerCase(), rest)
}

// What a dependency value points at, for the dependency called `name`.
export function npmTarget(name: string, value: string): Parsed {
  const v = value.trim()
  if (v.startsWith('npm:')) {
    const real = parseNpm(v.slice(4))
    return real === null || real.remote !== undefined ? real : { name: real.name, spec: real.spec }
  }
  if (LOCAL.test(v)) return null
  if (v !== '' && REMOTE.test(v)) return { name, spec: '', remote: v }
  return { name, spec: v }
}

// `pkg`, `pkg==1.0`, `pkg[extra]>=2; python_version<"3.9"`, `pkg @ https://…`.
export function parsePypi(raw: string): Parsed {
  const spec = raw.trim()
  if (spec === '' || LOCAL.test(spec)) return null
  const direct = /^([A-Za-z0-9][\w.-]*)\s*(\[[^\]]*\])?\s*@\s*(\S+)/.exec(spec)
  if (direct) return { name: normalizePypi(direct[1] ?? ''), spec: '', remote: direct[3] ?? '' }
  if (spec.includes('://') || /^git\+/.test(spec) || /\.(whl|tar\.gz|zip)$/.test(spec)) {
    return { name: '', spec: '', remote: spec }
  }
  const name = spec.split(/[\[<>=!~;\s(]/)[0] ?? ''
  if (!PYPI_NAME.test(name)) return null
  // Everything between the name (and extras) and any environment marker.
  const rest = spec.slice(name.length).replace(/^\s*\[[^\]]*\]/, '').split(';')[0] ?? ''
  return { name: normalizePypi(name), spec: rest.replace(/[()\s]/g, '') }
}

// Shell commands of a script, each as its words: quotes honoured, `\`-newline joined,
// split on unquoted ; & && || | and newlines.
export function commands(script: string, depth = 0): string[][] {
  const out: string[][] = []
  const subs: string[] = []
  let words: string[] = []
  let word = ''
  let hasWord = false
  const endWord = () => {
    if (hasWord) words.push(word)
    word = ''
    hasWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) out.push(words)
    words = []
  }
  for (let i = 0; i < script.length; i += 1) {
    const c = script[i] ?? ''
    if (c === '\\') {
      const n = script[i + 1]
      if (n === '\n') i += 1
      else if (n !== undefined) {
        word += n
        hasWord = true
        i += 1
      }
    } else if (c === "'") {
      const end = script.indexOf("'", i + 1)
      word += script.slice(i + 1, end < 0 ? script.length : end)
      hasWord = true
      i = end < 0 ? script.length : end
    } else if (c === '"') {
      hasWord = true
      let j = i + 1
      for (; j < script.length && script[j] !== '"'; j += 1) {
        if (script[j] === '\\' && j + 1 < script.length) j += 1
        // `"$(cmd)"` and `"`cmd`"` still run cmd: parse their insides as commands too.
        if (script[j] === '$' && script[j + 1] === '(') {
          let depth = 0
          let k = j + 1
          for (; k < script.length; k += 1) {
            if (script[k] === '(') depth += 1
            else if (script[k] === ')' && (depth -= 1) === 0) break
          }
          subs.push(script.slice(j + 2, k))
        } else if (script[j] === '`') {
          const k = script.indexOf('`', j + 1)
          if (k > j) subs.push(script.slice(j + 1, k))
        }
        word += script[j]
      }
      i = j
    } else if (c === '$' && script[i + 1] === "'") {
      // ANSI-C quoting: the quote branch reads what follows.
    } else if (c === '(' || c === ')') {
      endCommand()
      out.push([c])
    } else if (c === ';' || c === '\n' || c === '&' || c === '|' || c === '`') {
      endCommand()
    } else if (c === ' ' || c === '\t') {
      endWord()
    } else if (c === '#' && !hasWord) {
      while (i < script.length && script[i] !== '\n') i += 1
      endCommand()
    } else {
      word += c
      hasWord = true
    }
  }
  endCommand()
  if (depth < 3) for (const sub of subs) out.push(...commands(sub, depth + 1))
  return out
}

const NPM_VALUE = new Set([
  '--prefix', '-C', '--registry', '--userconfig', '-w', '--workspace', '--cache', '--loglevel', '--tag',
  '--filter', '-F', '--dir', '--cwd', '--save-prefix', '--otp', '--modules-folder',
])
const PIP_VALUE = new Set([
  '-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-i', '--index-url', '--extra-index-url',
  '-t', '--target', '--python', '-p', '--prefix', '--root', '--src', '--index', '--default-index', '--group',
  '--extra', '-f', '--find-links', '--trusted-host', '--platform', '--python-version', '--implementation',
  '--abi', '--only-binary', '--no-binary', '--upgrade-strategy', '--log', '--cache-dir', '--proxy', '--timeout',
  '--retries', '--config-settings', '--source', '--with', '--without', '-G', '--optional',
])
const NPM_REGISTRY_ENV = /^npm_config_registry$/i
const PIP_INDEX_ENV = /^(PIP_INDEX_URL|UV_INDEX_URL|UV_DEFAULT_INDEX)$/
const PIP_EXTRA_ENV = /^(PIP_EXTRA_INDEX_URL|UV_EXTRA_INDEX_URL|UV_INDEX)$/

type Opts = { operands: string[]; values: Map<string, string[]>; flags: Set<string> }

// Split args into operands, flag values (`--x v` and `--x=v`) and bare flags.
function options(args: string[], valued: Set<string>): Opts {
  const operands: string[] = []
  const values = new Map<string, string[]>()
  const flags = new Set<string>()
  const put = (k: string, v: string) => values.set(k, [...(values.get(k) ?? []), v])
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? ''
    if (a === '--') {
      operands.push(...args.slice(i + 1))
      break
    }
    const eq = a.startsWith('--') ? a.indexOf('=') : -1
    const short = /^-[a-zA-Z]/.test(a) && a.length > 2 && valued.has(a.slice(0, 2)) ? a.slice(0, 2) : ''
    if (eq > 0) put(a.slice(0, eq), a.slice(eq + 1))
    else if (short !== '') put(short, a.slice(2))
    else if (valued.has(a)) {
      put(a, args[i + 1] ?? '')
      i += 1
    } else if (a.startsWith('-')) flags.add(a)
    else operands.push(a)
  }
  return { operands, values, flags }
}

const first = (o: Opts, ...keys: string[]) => keys.map(k => o.values.get(k)?.[0]).find(v => v !== undefined)

export type BashFinding = {
  wanted: Wanted[]
  // `pip install -r <file>`, resolved against the command's directory.
  requirements: { path: string; via: string; group: number; registry?: Registry; noBinary?: string[] }[]
  // A bare `npm install` & co. in this directory: installs whatever package.json says.
  bare: {
    dir: string
    via: string
    registry?: Registry
    ignoreScripts: boolean
    isClean: boolean
    honorsLock: boolean
    publicExplicit?: boolean
    userconfig?: string
    tool: string
  }[]
  // `uv sync` / `poetry install`: installs what pyproject.toml declares.
  barePy: { dir: string; via: string }[]
}

const join = (dir: string, raw: string) => {
  const path = tilde(raw)
  return path.startsWith('/') ? path : dir === '' || dir === '.' ? path : `${dir.replace(/\/$/, '')}/${path}`
}

// What a shell command would fetch from a registry.
export function fromBash(
  script: string,
  depth = 0,
  start = '',
  vars = new Map<string, string>(),
  exported = new Map<string, string>(),
): BashFinding {
  const found: BashFinding = { wanted: [], requirements: [], bare: [], barePy: [] }
  let cwd = start
  const stack: string[] = []
  const expand = (w: string) =>
    w.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, k: string) => vars.get(k) ?? m)
  for (const raw of commands(script)) {
    if (raw[0] === '(' && raw.length === 1) {
      stack.push(cwd)
      continue
    }
    if (raw[0] === ')' && raw.length === 1) {
      cwd = stack.pop() ?? cwd
      continue
    }
    let words = raw.map(expand)
    // `export X=1` / `declare -x X=1`: set for this shell and every later command.
    const isExport = words[0] === 'export' || (['declare', 'typeset'].includes(words[0] ?? '') && words.includes('-x'))
    if (isExport) words = words.slice(1).filter(w => !w.startsWith('-'))
    // `PKG=x` on its own sets a shell variable for later commands.
    if (words.length > 0 && words.every(w => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w))) {
      for (const w of words) {
        const k = w.slice(0, w.indexOf('='))
        const v = w.slice(w.indexOf('=') + 1)
        vars.set(k, v)
        if (isExport) exported.set(k, v)
      }
      continue
    }
    if (isExport) continue
    // Config changes made earlier in the same script redirect later installs.
    const tool0 = (words[0] ?? '').split('/').pop()
    if (tool0 === 'npm' && words[1] === 'config' && words[2] === 'set' && words[3] !== undefined) {
      const [key, inline] = (words[3] ?? '').split('=')
      if (key === 'registry') exported.set('npm_config_registry', inline ?? words[4] ?? '')
      continue
    }
    if (/^pip[0-9.]*$/.test(tool0 ?? '') && words[1] === 'config' && words[2] === 'set') {
      if (/index-url$/.test(words[3] ?? '')) exported.set(/extra/.test(words[3] ?? '') ? 'PIP_EXTRA_INDEX_URL' : 'PIP_INDEX_URL', words[4] ?? '')
      continue
    }
    const env = new Map<string, string>(exported)
    let argv = words
    // Leading assignments and wrappers that run the real command.
    for (;;) {
      const head = argv[0] ?? ''
      const assign = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(head)
      if (assign) {
        env.set(assign[1] ?? '', assign[2] ?? '')
        argv = argv.slice(1).map(w => w.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, k: string) => env.get(k) ?? m))
      } else if (['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}'].includes(head)) {
        argv = argv.slice(1)
      } else if (['sudo', 'env', 'command', 'time', 'nice', 'corepack', 'exec', 'nohup'].includes(head)) {
        argv = argv.slice(1)
        while ((argv[0] ?? '').startsWith('-')) {
          const flag = argv[0] ?? ''
          argv = argv.slice(['-u', '-g', '-n', '-C', '-D'].includes(flag) ? 2 : 1)
        }
      } else break
    }
    const [path, ...args] = argv
    if (path === undefined) continue
    // `.venv/bin/pip`, `/usr/local/bin/npm`: the program is the last path part.
    const tool = path.split('/').pop() ?? path
    if (tool === 'cd') {
      cwd = join(cwd, args[0] ?? HOME)
      continue
    }
    if (tool === 'eval') {
      if (depth < 3) merge(found, fromBash(args.join(' '), depth + 1, cwd, vars, exported))
      continue
    }
    if (['bash', 'sh', 'zsh', 'dash'].includes(tool)) {
      const c = args.findIndex(a => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a))
      if (c >= 0 && depth < 3) merge(found, fromBash(args[c + 1] ?? '', depth + 1, cwd, new Map(), new Map(exported)))
      continue
    }
    if ((tool === 'uv' && args[0] === 'sync') || (tool === 'poetry' && args[0] === 'install')) {
      found.barePy.push({ dir: cwd, via: `${tool} ${args[0]}` })
      continue
    }
    if (/^python[0-9.]*$/.test(tool) && args[0] === '-m') {
      merge(found, pip(args[1] ?? '', args.slice(2), env, cwd))
      continue
    }
    merge(found, npmFamily(tool, args, env, cwd))
    merge(found, pip(tool, args, env, cwd))
  }
  return found
}

function merge(into: BashFinding, from: BashFinding) {
  into.wanted.push(...from.wanted)
  into.requirements.push(...from.requirements)
  into.bare.push(...from.bare)
  into.barePy.push(...from.barePy)
}

function npmFamily(tool: string, args: string[], env: Map<string, string>, cwd: string): BashFinding {
  const found: BashFinding = { wanted: [], requirements: [], bare: [], barePy: [] }
  if (!['npm', 'pnpm', 'yarn', 'bun', 'npx', 'bunx'].includes(tool)) return found
  let o = options(args, NPM_VALUE)
  let [verb, ...ops] = o.operands
  // `yarn workspace <name> add …` runs `add` inside that workspace.
  if (tool === 'yarn' && verb === 'workspace') {
    ;[, verb, ...ops] = ops
  }
  const envRegistry = [...env].find(([k]) => NPM_REGISTRY_ENV.test(k))?.[1]
  const url = first(o, '--registry') ?? envRegistry
  const registry = url !== undefined && url !== '' && !isPublicRegistry(url) ? { url, isExtra: false } : undefined
  const publicExplicit = url !== undefined && isPublicRegistry(url)
  const dir = join(cwd, first(o, '--prefix', '-C', '--dir', '--cwd') ?? '')
  const userconfig = first(o, '--userconfig')
  const ignoreScripts = o.flags.has('--ignore-scripts')
  const via = `${tool} ${verb ?? ''}`.trim()

  const add = (specs: string[]) => {
    for (const s of specs) {
      const p = parseNpm(s)
      if (p === null) continue
      found.wanted.push({
        eco: 'npm',
        name: p.name,
        spec: p.spec,
        via,
        ...(p.remote !== undefined ? { remote: p.remote } : {}),
        ...(registry !== undefined ? { registry } : {}),
        ...(publicExplicit ? { publicExplicit } : {}),
        ...(ignoreScripts ? { ignoreScripts } : {}),
        ...(dir !== '' ? { dir } : {}),
        ...(userconfig !== undefined ? { userconfig: join(cwd, userconfig) } : {}),
      })
    }
  }
  const install = ['i', 'install', 'add', 'in', 'ins', 'isntall', 'a', 'ci', 'update', 'upgrade', 'up', 'udpate']
  if (tool === 'npx' || tool === 'bunx') {
    o = options(args, new Set([...NPM_VALUE, '-p', '--package']))
    const pkgs = o.values.get('-p') ?? o.values.get('--package')
    add(pkgs ?? o.operands.slice(0, 1))
  } else if ((tool === 'npm' && ['exec', 'x'].includes(verb ?? '')) || (tool === 'bun' && verb === 'x')) {
    o = options(args, new Set([...NPM_VALUE, '-p', '--package']))
    add(o.values.get('-p') ?? o.values.get('--package') ?? o.operands.slice(1, 2))
  } else if (['dlx', 'create', 'init'].includes(verb ?? '') && ops[0] !== undefined) {
    // `npm create foo` / `yarn create foo` run the `create-foo` package.
    const target = ops[0]
    const isCreate = verb !== 'dlx' && !target.startsWith('-')
    if (verb === 'dlx') add([target])
    else if (isCreate) {
      const p = parseNpm(target)
      if (p !== null && p.remote === undefined) {
        const scoped = p.name.startsWith('@')
        const name = scoped ? (p.name.includes('/') ? p.name.replace('/', '/create-') : `${p.name}/create`) : `create-${p.name}`
        add([p.spec === '' ? name : `${name}@${p.spec}`])
      }
    }
  } else if (verb === undefined ? tool === 'yarn' : install.includes(verb)) {
    if (ops.length === 0 || verb === 'ci') {
      found.bare.push({
        dir,
        via,
        tool,
        ...(registry ? { registry } : {}),
        ...(userconfig !== undefined ? { userconfig: join(cwd, userconfig) } : {}),
        ignoreScripts,
        isClean: verb === 'ci',
        // Updates move within the range, and --package-lock=false ignores the lock.
        honorsLock: !['update', 'upgrade', 'up', 'udpate'].includes(verb ?? '') && !o.flags.has('--no-package-lock') && first(o, '--package-lock') !== 'false',
        ...(publicExplicit ? { publicExplicit } : {}),
      })
    }
    else add(ops)
  }
  return found
}

let GROUP = 0

function pip(tool: string, args: string[], env: Map<string, string>, cwd: string): BashFinding {
  const group = (GROUP += 1)
  const found: BashFinding = { wanted: [], requirements: [], bare: [], barePy: [] }
  let rest: string[]
  if (/^pip[0-9.]*$/.test(tool)) {
    const o = options(args, PIP_VALUE)
    if (o.operands[0] !== 'install') return found
    rest = args.slice(args.indexOf('install') + 1)
  } else if (tool === 'uv') {
    const o = options(args, PIP_VALUE)
    const [verb, sub] = o.operands
    if (verb === 'add') rest = args.slice(args.indexOf('add') + 1)
    else if ((verb === 'pip' || verb === 'tool') && sub === 'install') rest = args.slice(args.indexOf('install') + 1)
    else return found
  } else if (tool === 'uvx') {
    rest = options(args, PIP_VALUE).operands.slice(0, 1)
  } else if (tool === 'poetry') {
    if (options(args, PIP_VALUE).operands[0] !== 'add') return found
    rest = args.slice(args.indexOf('add') + 1)
  } else if (tool === 'pipx') {
    const verb = options(args, PIP_VALUE).operands[0]
    if (verb !== 'install' && verb !== 'run') return found
    rest = options(args.slice(args.indexOf(verb) + 1), PIP_VALUE).operands.slice(0, 1)
  } else return found

  const o = options(rest, PIP_VALUE)
  const index = first(o, '-i', '--index-url', '--default-index') ?? [...env].find(([k]) => PIP_INDEX_ENV.test(k))?.[1]
  const extra = first(o, '--extra-index-url', '--index') ?? [...env].find(([k]) => PIP_EXTRA_ENV.test(k))?.[1]
  const links = first(o, '-f', '--find-links')
  const registry: Registry | undefined = o.flags.has('--no-index')
    ? { url: links ?? 'local files only (--no-index)', isExtra: false }
    : index !== undefined && index !== '' && !isPublicRegistry(index)
      ? { url: index, isExtra: false }
      : extra !== undefined && extra !== ''
        ? { url: extra, isExtra: true }
        : links !== undefined
          ? { url: links, isExtra: true }
          : undefined
  const noBinary = (o.values.get('--no-binary') ?? []).flatMap(v => v.split(','))
  const builds = (name: string) => noBinary.includes(':all:') || noBinary.map(normalizePypi).includes(name)
  const via = `${tool} install`
  for (const file of [...(o.values.get('-r') ?? []), ...(o.values.get('--requirement') ?? [])]) {
    found.requirements.push({ path: join(cwd, file), via, group, ...(registry ? { registry } : {}), ...(noBinary.length > 0 ? { noBinary } : {}) })
  }
  const editable = [...(o.values.get('-e') ?? []), ...(o.values.get('--editable') ?? [])]
  for (const s of [...o.operands, ...editable]) {
    const p = parsePypi(s)
    if (p === null) continue
    found.wanted.push({
      eco: 'pypi',
      name: p.name,
      spec: p.spec,
      via,
      ...(p.remote !== undefined ? { remote: p.remote } : {}),
      ...(registry !== undefined ? { registry } : {}),
      ...(builds(p.name) ? { sourceBuild: true } : {}),
      group,
    })
  }
  return found
}

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

// Every dependency a manifest declares: name -> what it points at (spec or remote).
export type Deps = Map<string, { spec: string; remote?: string; realName: string }>

// Overrides nest (`"a": { "b": "1.0" }`); flatten to name -> value.
function flatten(value: unknown, out: Map<string, string>) {
  if (typeof value !== 'object' || value === null) return
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out.set(k === '.' ? '.' : k.replace(/^.*>/, '').replace(/@[^/]*$/, '') || k, v)
    else {
      // `"foo": { ".": "1.0", "bar": "2.0" }` overrides foo itself with ".".
      const self = (v as Record<string, unknown>)['.']
      if (typeof self === 'string') out.set(k.replace(/@[^/]*$/, '') || k, self)
      flatten(v, out)
    }
  }
}

export function packageJsonDeps(text: string): Deps | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const out: Deps = new Map()
  if (typeof json !== 'object' || json === null) return out
  const root = json as Record<string, unknown>
  const raw = new Map<string, string>()
  for (const field of DEP_FIELDS) {
    const deps = root[field]
    if (typeof deps !== 'object' || deps === null) continue
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof spec === 'string') raw.set(name, spec)
    }
  }
  const overrides = new Map<string, string>()
  flatten(root.overrides, overrides)
  flatten(root.resolutions, overrides)
  flatten((root.pnpm as Record<string, unknown> | undefined)?.overrides, overrides)
  for (const [name, spec] of overrides) if (name !== '.') raw.set(`${name} (override)`, spec)
  for (const [key, value] of raw) {
    const name = key.replace(/ \(override\)$/, '').toLowerCase()
    if (!NPM_NAME.test(name)) continue
    const target = npmTarget(name, value)
    if (target === null) continue
    out.set(key.toLowerCase(), { spec: target.spec, realName: target.name, ...(target.remote ? { remote: target.remote } : {}) })
  }
  return out
}

// Lifecycle scripts in a package.json that run on every install of it.
export function lifecycleScripts(text: string): Record<string, string> {
  try {
    const scripts = (JSON.parse(text) as { scripts?: Record<string, unknown> }).scripts ?? {}
    const out: Record<string, string> = {}
    for (const k of ['preinstall', 'install', 'postinstall', 'prepare']) {
      const v = scripts[k]
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

// Requirements lines with `\` continuations joined.
const logical = (text: string) => text.replace(/\\\r?\n/g, ' ').split('\n')

export function requirementsDeps(text: string): Deps {
  const out: Deps = new Map()
  for (const raw of logical(text)) {
    // Per-requirement options (`--hash=…`, `--config-settings …`) follow the spec.
    let line = raw.replace(/(^|\s)#.*$/, '').replace(/\s--?[a-z][\w-]*(?:[=\s]\S+)?/gi, '').trim()
    const editable = /^(-e|--editable)[\s=]+(\S+)/.exec(line)
    if (editable) line = editable[2] ?? ''
    else if (line === '' || line.startsWith('-')) continue
    const p = parsePypi(line)
    if (p === null) continue
    out.set(p.name || p.remote || line, { spec: p.spec, realName: p.name, ...(p.remote ? { remote: p.remote } : {}) })
  }
  return out
}

// `-r other.txt` / `-c other.txt` lines a requirements file includes.
export function requirementsIncludes(text: string): string[] {
  const out: string[] = []
  for (const raw of logical(text)) {
    const m = /^\s*(-r|--requirement)(?:[\s=]+|(?=[^\s=-]))(\S+)/.exec(raw)
    if (m) out.push(m[2] ?? '')
  }
  return out
}

// The index a requirements file points pip at, if it sets one.
export function requirementsIndex(text: string): Registry | undefined {
  let index: string | undefined
  let extra: string | undefined
  for (const raw of text.split('\n')) {
    const i = /^\s*(-i|--index-url)[\s=]+(\S+)/.exec(raw)?.[2]
    const x = /^\s*--extra-index-url[\s=]+(\S+)/.exec(raw)?.[1]
    if (i !== undefined && !isPublicRegistry(i)) index = i
    if (x !== undefined) extra = x
  }
  return index !== undefined ? { url: index, isExtra: false } : extra !== undefined ? { url: extra, isExtra: true } : undefined
}

// Strings and bracket depth of TOML, outside comments: enough to read dependency arrays.
function tomlStrings(line: string): { strings: string[]; delta: number } {
  const strings: string[] = []
  let delta = 0
  let braces = 0
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (c === '#') break
    if (c === '"' || c === "'") {
      let j = i + 1
      let s = ''
      for (; j < line.length && line[j] !== c; j += 1) {
        if (c === '"' && line[j] === '\\') j += 1
        s += line[j] ?? ''
      }
      if (braces === 0) strings.push(s)
      i = j
    } else if (c === '[') delta += 1
    else if (c === ']') delta -= 1
    else if (c === '{') braces += 1
    else if (c === '}') braces -= 1
  }
  return { strings, delta }
}

// pyproject.toml: PEP 621 / PEP 735 dependency arrays and Poetry dependency tables.
export function pyprojectDeps(text: string): Deps {
  const out: Deps = new Map()
  const add = (s: string) => {
    const p = parsePypi(s)
    if (p !== null) out.set(p.name || p.remote || s, { spec: p.spec, realName: p.name, ...(p.remote ? { remote: p.remote } : {}) })
  }
  let table = ''
  let depth = 0
  // A Poetry inline table spread over lines, joined until its braces close.
  let pending = ''
  for (const raw of text.split('\n')) {
    let line = raw.trim()
    if (pending !== '') {
      pending += ` ${line.replace(/#.*$/, '')}`
      if ((pending.match(/\{/g) ?? []).length > (pending.match(/\}/g) ?? []).length) continue
      line = pending
      pending = ''
    } else if (/^[\w."'-]+\s*=\s*\{/.test(line) && (line.match(/\{/g) ?? []).length > (line.replace(/#.*$/, '').match(/\}/g) ?? []).length) {
      pending = line.replace(/#.*$/, '')
      continue
    }
    if (depth === 0) {
      const header = /^\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/.exec(line)
      if (header) {
        table = (header[1] ?? '').replace(/["']/g, '')
        continue
      }
    }
    if (depth > 0) {
      const { strings, delta } = tomlStrings(line)
      strings.forEach(add)
      depth += delta
      continue
    }
    const kv = /^("[^"]+"|'[^']+'|[\w.-]+)\s*=\s*(.*)$/.exec(line)
    if (kv === null) continue
    const key = (kv[1] ?? '').replace(/^["']|["']$/g, '')
    const value = kv[2] ?? ''
    const isArray =
      (table === 'project' && key === 'dependencies') ||
      table === 'project.optional-dependencies' ||
      table === 'dependency-groups'
    if (isArray && value.startsWith('[')) {
      const { strings, delta } = tomlStrings(value)
      // Dependency-group entries can be `{ include-group = "x" }`: tomlStrings skips those.
      strings.forEach(add)
      depth = Math.max(0, delta)
      continue
    }
    if (/^tool\.poetry\.(dev-)?dependencies$|^tool\.poetry\.group\.[\w-]+\.dependencies$/.test(table)) {
      if (key === 'python') continue
      const name = normalizePypi(key)
      if (value.startsWith('{')) {
        if (/\b(path|file)\s*=/.test(value)) continue
        const url = /\b(git|url)\s*=\s*["']([^"']+)["']/.exec(value)?.[2]
        const version = /\bversion\s*=\s*["']([^"']+)["']/.exec(value)?.[1] ?? ''
        out.set(name, { spec: exactPin(version), realName: name, ...(url ? { remote: url } : {}) })
      } else {
        out.set(name, { spec: exactPin(value.replace(/["']/g, '').trim()), realName: name })
      }
    }
  }
  return out
}

// Poetry constraints in PEP 440 terms: `1.2.3` is exact, `^`/`~` are ranges.
function exactPin(raw: string): string {
  const v = raw.trim()
  if (v === '' || v === '*') return ''
  if (/^\d[\w.+!-]*$/.test(v)) return `==${v}`
  const caret = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(v)
  if (caret) {
    const [maj, min, pat] = [Number(caret[1]), Number(caret[2] ?? 0), Number(caret[3] ?? 0)]
    const upper = maj > 0 || caret[2] === undefined ? `${maj + 1}` : min > 0 || caret[3] === undefined ? `0.${min + 1}` : `0.0.${pat + 1}`
    return `>=${maj}.${min}.${pat},<${upper}`
  }
  const tilde = /^~(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(v)
  if (tilde) {
    const [maj, min] = [Number(tilde[1]), Number(tilde[2] ?? 0)]
    return `>=${maj}.${min}.${Number(tilde[3] ?? 0)},<${tilde[2] === undefined ? maj + 1 : `${maj}.${min + 1}`}`
  }
  return v.replace(/\s+/g, '')
}

export type Manifest = 'package.json' | 'requirements' | 'pyproject'

export function manifestKind(path: string): Manifest | null {
  const parts = path.split('/')
  const base = parts.pop() ?? ''
  if (base === 'package.json') return 'package.json'
  if (/^requirements.*\.(txt|in)$/.test(base)) return 'requirements'
  if (parts.pop() === 'requirements' && /\.(txt|in)$/.test(base)) return 'requirements'
  if (base === 'pyproject.toml') return 'pyproject'
  return null
}

export function depsOf(kind: Manifest, text: string): Deps | null {
  if (kind === 'package.json') return packageJsonDeps(text)
  if (kind === 'requirements') return requirementsDeps(text)
  return pyprojectDeps(text)
}

export function dedupe(list: Wanted[]): Wanted[] {
  const seen = new Set<string>()
  return list.filter(w => {
    const key = JSON.stringify([w.eco, w.name, w.spec, w.remote, w.registry, w.ignoreScripts, w.dir, w.sourceBuild, w.group])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
