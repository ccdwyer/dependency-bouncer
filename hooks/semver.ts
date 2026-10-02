// Just enough of npm's semver to know which release a range installs: the highest
// published version that satisfies it, as npm picks.

type V = [number, number, number, string]

function parse(v: string): V | null {
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?\s*$/.exec(v)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? ''] : null
}

function cmp(a: V, b: V): number {
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] as number) - (b[i] as number)
    if (d !== 0) return d
  }
  if (a[3] === b[3]) return 0
  if (a[3] === '') return 1
  if (b[3] === '') return -1
  // Pre-release identifiers compare dot by dot: numbers numerically, below words.
  const x = a[3].split('.')
  const y = b[3].split('.')
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const p = x[i]
    const q = y[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    const pn = /^\d+$/.test(p)
    const qn = /^\d+$/.test(q)
    if (pn && qn) return Number(p) - Number(q)
    if (pn) return -1
    if (qn) return 1
    return p < q ? -1 : 1
  }
  return 0
}

type Test = (v: V) => boolean

// `1`, `1.2`, `1.x`, `*` -> the parts given, and how many.
function partial(p: string): { parts: number[]; n: number; pre: string } | null {
  if (p === '' || p === '*' || /^[xX]$/.test(p)) return { parts: [0, 0, 0], n: 0, pre: '' }
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(p)
  if (!m) return null
  const raw = [m[1], m[2], m[3]]
  let n = 0
  const parts = raw.map(x => {
    if (x === undefined || /^[xX*]$/.test(x)) return 0
    n += 1
    return Number(x)
  })
  // `1.x.3` is not a thing: stop counting at the first wildcard.
  const firstWild = raw.findIndex(x => x === undefined || /^[xX*]$/.test(x))
  if (firstWild >= 0) n = Math.min(n, firstWild)
  return { parts, n, pre: m[4] ?? '' }
}

const at = (parts: number[], pre = ''): V => [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, pre]

function comparator(c: string): Test | null {
  const m = /^(\^|~>?|>=|<=|>|<|=)?\s*(.*)$/.exec(c.trim())
  if (!m) return null
  const op = m[1] ?? ''
  const p = partial(m[2] ?? '')
  if (p === null) return null
  const { parts, n, pre } = p
  const lo = at(parts, pre)
  const bump = (i: number): V => {
    const next = [...parts]
    next[i] = (next[i] ?? 0) + 1
    for (let j = i + 1; j < 3; j += 1) next[j] = 0
    return at(next, '0')
  }
  if (op === '' || op === '=') {
    if (n === 3) return v => cmp(v, lo) === 0
    if (n === 0) return () => true
    const hi = bump(n - 1)
    return v => cmp(v, lo) >= 0 && cmp(v, hi) < 0
  }
  if (op === '^') {
    const i = n === 0 ? 0 : parts[0] !== 0 ? 0 : n === 1 ? 0 : parts[1] !== 0 ? 1 : n === 2 ? 1 : 2
    if (n === 0) return () => true
    const hi = bump(i)
    return v => cmp(v, lo) >= 0 && cmp(v, hi) < 0
  }
  if (op.startsWith('~')) {
    if (n === 0) return () => true
    const hi = bump(n === 1 ? 0 : 1)
    return v => cmp(v, lo) >= 0 && cmp(v, hi) < 0
  }
  if (op === '>=') return v => cmp(v, lo) >= 0
  if (op === '<') return v => cmp(v, lo) < 0
  if (op === '>') return n === 3 || n === 0 ? v => cmp(v, lo) > 0 : v => cmp(v, bump(n - 1)) >= 0
  if (op === '<=') return n === 3 || n === 0 ? v => cmp(v, lo) <= 0 : v => cmp(v, bump(n - 1)) < 0
  return null
}

// A range as npm writes it: `||` alternatives of space-separated comparators, or `a - b`.
// A pre-release matches only when a comparator of its set names a pre-release of the
// same major.minor.patch, as in npm.
function range(r: string): Test | null {
  const alternatives: Test[] = []
  for (const alt of r.split('||')) {
    const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(alt)
    const parts = hyphen ? [`>=${hyphen[1]}`, `<=${hyphen[2]}`] : alt.trim().replace(/([<>=~^]+)\s+/g, '$1').split(/\s+/)
    const tests: Test[] = []
    const pres: V[] = []
    for (const part of parts) {
      if (part === '') continue
      const t = comparator(part)
      if (t === null) return null
      tests.push(t)
      const p = partial(part.replace(/^[<>=~^]+/, ''))
      if (p !== null && p.pre !== '') pres.push(at(p.parts, p.pre))
    }
    alternatives.push(v => {
      if (v[3] !== '' && !pres.some(p => p[0] === v[0] && p[1] === v[1] && p[2] === v[2])) return false
      return tests.every(t => t(v))
    })
  }
  return alternatives.length === 0 ? null : v => alternatives.some(t => t(v))
}

// The highest version satisfying `r`, `null` when none does, `undefined` when `r` can't be read.
export function maxSatisfying(versions: string[], r: string): string | null | undefined {
  const test = range(r.trim() === '' ? '*' : r)
  if (test === null) return undefined
  let best: { raw: string; v: V } | null = null
  for (const raw of versions) {
    const v = parse(raw)
    if (v === null) continue
    if (test(v) && (best === null || cmp(v, best.v) > 0)) best = { raw, v }
  }
  return best?.raw ?? null
}

export const isVersion = (v: string) => parse(v) !== null
