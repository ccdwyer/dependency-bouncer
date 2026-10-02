// Just enough of PEP 440 to know which release pip installs for a specifier:
// the highest final release that matches every clause.

type Version = { release: number[]; pre: [number, number] | null; post: number; dev: number; isPre: boolean }

const PRE: Record<string, number> = { a: 0, alpha: 0, b: 1, beta: 1, c: 2, rc: 2, pre: 2, preview: 2 }

export function parse(raw: string): Version | null {
  const m = /^\s*v?(?:\d+!)?(\d+(?:\.\d+)*)(?:[-_.]?(a|alpha|b|beta|c|rc|pre|preview)[-_.]?(\d*))?(?:-(\d+)|[-_.]?(?:post|rev|r)[-_.]?(\d*))?(?:[-_.]?dev[-_.]?(\d*))?(?:\+[\w.]+)?\s*$/i.exec(raw)
  if (!m) return null
  const pre = m[2] === undefined ? null : ([PRE[m[2].toLowerCase()] ?? 0, Number(m[3] || 0)] as [number, number])
  const post = m[4] !== undefined ? Number(m[4]) : m[5] !== undefined ? Number(m[5] || 0) : -1
  const dev = m[6] !== undefined ? Number(m[6] || 0) : Infinity
  return { release: (m[1] ?? '0').split('.').map(Number), pre, post, dev, isPre: pre !== null || dev !== Infinity }
}

function cmpRelease(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function cmp(a: Version, b: Version): number {
  const r = cmpRelease(a.release, b.release)
  if (r !== 0) return r
  // A dev release of a final version sorts before its pre-releases.
  const preKey = (v: Version): [number, number] => (v.pre !== null ? v.pre : v.dev !== Infinity && v.post < 0 ? [-1, 0] : [9, 0])
  const [ap, an] = preKey(a)
  const [bp, bn] = preKey(b)
  if (ap !== bp) return ap - bp
  if (an !== bn) return an - bn
  if (a.post !== b.post) return a.post - b.post
  return a.dev === b.dev ? 0 : a.dev < b.dev ? -1 : 1
}

type Test = (v: Version) => boolean

function clause(c: string): Test | null {
  const m = /^\s*(~=|===|==|!=|<=|>=|<|>)\s*(\S+)\s*$/.exec(c)
  if (!m) return null
  const op = m[1] ?? ''
  const text = m[2] ?? ''
  if (op === '===') return v => text === v.release.join('.')
  if ((op === '==' || op === '!=') && text.endsWith('.*')) {
    const prefix = parse(text.slice(0, -2))
    if (prefix === null) return null
    const match: Test = v => prefix.release.every((n, i) => (v.release[i] ?? 0) === n)
    return op === '==' ? match : v => !match(v)
  }
  const target = parse(text)
  if (target === null) return null
  switch (op) {
    case '==':
      return v => cmp(v, target) === 0
    case '!=':
      return v => cmp(v, target) !== 0
    case '>=':
      return v => cmp(v, target) >= 0
    case '<=':
      return v => cmp(v, target) <= 0
    case '>':
      return v => cmp(v, target) > 0
    case '<':
      return v => cmp(v, target) < 0
    case '~=': {
      if (target.release.length < 2) return null
      const upper = target.release.slice(0, -1)
      upper[upper.length - 1] = (upper[upper.length - 1] ?? 0) + 1
      return v => cmp(v, target) >= 0 && cmpRelease(v.release, upper) < 0
    }
    default:
      return null
  }
}

// The highest published release matching `spec` (comma-separated clauses): `null` when
// none matches, `undefined` when the spec can't be read. Pre-releases count only when
// the spec names one, as pip does.
export function best(versions: string[], spec: string): string | null | undefined {
  const clauses = spec.split(',').map(s => s.trim()).filter(Boolean)
  const tests: Test[] = []
  for (const c of clauses) {
    const t = clause(c)
    if (t === null) return undefined
    tests.push(t)
  }
  const allowPre = clauses.some(c => parse(c.replace(/^[^\d]*/, ''))?.isPre === true)
  let top: { raw: string; v: Version } | null = null
  for (const raw of versions) {
    const v = parse(raw)
    if (v === null || (v.isPre && !allowPre)) continue
    if (tests.every(t => t(v)) && (top === null || cmp(v, top.v) > 0)) top = { raw, v }
  }
  return top?.raw ?? null
}
