/** API base: empty string uses same origin (Docker) or Vite dev proxy → FastAPI on :8000 */
export function apiBase(): string {
  const v = import.meta.env.VITE_API_URL as string | undefined
  if (v !== undefined && v !== '') return v.replace(/\/$/, '')
  return ''
}

/** Full URL to `/api/health` (same tab origin in production; Vite proxy in dev). */
export function apiHealthUrl(): string {
  const base = apiBase()
  if (base) return `${base}/api/health`
  if (typeof window !== 'undefined')
    return `${window.location.origin}/api/health`
  return '/api/health'
}

export type RunCreateBody = {
  requirements: string
  module_name?: string
  class_name?: string
}

export async function startRun(body: RunCreateBody): Promise<{ run_id: string }> {
  const base = apiBase()
  const payload = {
    requirements: body.requirements,
    module_name: body.module_name ?? 'module.py',
    class_name: body.class_name ?? 'Main',
  }
  const r = await fetch(`${base}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const t = await r.text()
    const hint =
      r.status === 502 || r.status === 503
        ? ' Start the API from the repo root: npm run api (expects http://127.0.0.1:8000).'
        : ''
    throw new Error((t || `HTTP ${r.status}`) + hint)
  }
  return r.json() as Promise<{ run_id: string }>
}

export function streamUrl(runId: string): string {
  return `${apiBase()}/api/runs/${runId}/stream`
}

export function outputDownloadAllUrl(): string {
  return `${apiBase()}/api/output/download-all`
}

export function outputFileUrl(name: string): string {
  return `${apiBase()}/api/output/file/${encodeURIComponent(name)}`
}

export type OutputListResult = {
  files: { name: string; size: number }[]
  /** Set when the list request failed (so UI is not confused with "empty output"). */
  error?: string
}

export async function fetchOutputList(): Promise<OutputListResult> {
  const base = apiBase()
  try {
    const r = await fetch(`${base}/api/output/list`)
    if (!r.ok) {
      return {
        files: [],
        error: `HTTP ${r.status} — is FastAPI running on port 8000?`,
      }
    }
    const d = (await r.json()) as { files?: { name: string; size: number }[] }
    return { files: d.files ?? [] }
  } catch (e) {
    return {
      files: [],
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

/** Retries: fixes brief 502 after navigation, or listing before files hit disk. */
export async function fetchOutputListWithRetry(
  maxAttempts = 8,
  delayMs = 500,
): Promise<OutputListResult> {
  let last: OutputListResult = { files: [] }
  for (let i = 0; i < maxAttempts; i++) {
    last = await fetchOutputList()
    if (last.files.length > 0) return last
    if (!last.error && i >= 2) return last
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return last
}

export async function fetchOutputContent(
  name: string,
): Promise<string | null> {
  const r = await fetch(
    `${apiBase()}/api/output/content/${encodeURIComponent(name)}`,
  )
  if (!r.ok) return null
  const d = (await r.json()) as { content?: string }
  return d.content ?? null
}

/** Fetch-based SSE reader (avoids EventSource auto-reconnect after stream ends). */
export async function consumeSseStream(
  runId: string,
  onData: (jsonLine: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = streamUrl(runId)
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const t = await res.text()
    const hint =
      res.status === 502 || res.status === 503
        ? ' Start the API: npm run api (port 8000).'
        : ''
    throw new Error((t || `HTTP ${res.status}`) + hint)
  }
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    for (;;) {
      const sep = buf.indexOf('\n\n')
      if (sep < 0) break
      const block = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) {
          onData(line.slice(5).trimStart())
        }
      }
    }
  }
}
