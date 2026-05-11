import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileJson,
  FileText,
  Folder,
  Globe,
  Info,
  MoreVertical,
  Settings2,
  Download,
  CheckCircle2,
  FileCode,
} from 'lucide-react'
import {
  apiBase,
  fetchOutputContent,
  fetchOutputListWithRetry,
  outputDownloadAllUrl,
  outputFileUrl,
} from '../lib/api'

type FsNode = {
  name: string
  kind: 'file' | 'folder'
  lang?: 'py' | 'json' | 'css' | 'md' | 'gitignore'
  children?: FsNode[]
}

const FALLBACK_README = `# Generated output

Use **Download all** to fetch a zip of everything in \`output/\`, or pick a file in the explorer.
`

function inferLang(name: string): FsNode['lang'] | undefined {
  const lower = name.toLowerCase()
  if (lower.endsWith('.py')) return 'py'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.md')) return 'md'
  if (lower.endsWith('.gitignore')) return 'gitignore'
  return undefined
}

function FileIcon({ node }: { node: FsNode }) {
  if (node.kind === 'folder')
    return <Folder className="h-4 w-4 shrink-0 text-amber-400/90" />
  switch (node.lang) {
    case 'py':
      return <FileCode className="h-4 w-4 shrink-0 text-sky-400" />
    case 'json':
      return <FileJson className="h-4 w-4 shrink-0 text-amber-300" />
    case 'css':
      return <Globe className="h-4 w-4 shrink-0 text-cyan-400" />
    case 'md':
      return <Info className="h-4 w-4 shrink-0 text-violet-300" />
    case 'gitignore':
      return <Settings2 className="h-4 w-4 shrink-0 text-white/45" />
    default:
      return <FileText className="h-4 w-4 shrink-0 text-white/55" />
  }
}

function TreeRow({
  node,
  depth,
  selected,
  onSelect,
  openFolders,
  toggle,
}: {
  node: FsNode
  depth: number
  selected: string
  onSelect: (path: string) => void
  openFolders: Set<string>
  toggle: (path: string) => void
}) {
  const path = node.name
  const isFolder = node.kind === 'folder'
  const isOpen = openFolders.has(path)

  const pad = { paddingLeft: 8 + depth * 14 }

  if (isFolder) {
    return (
      <div>
        <button
          type="button"
          style={pad}
          className="flex w-full items-center gap-1 rounded-lg py-1.5 text-left text-sm text-white/75 transition hover:bg-white/[0.05]"
          onClick={() => toggle(path)}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
          )}
          <FileIcon node={node} />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen &&
          node.children?.map((c) => (
            <TreeRow
              key={`${path}/${c.name}`}
              node={{ ...c, name: `${path}/${c.name}` }}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              openFolders={openFolders}
              toggle={toggle}
            />
          ))}
      </div>
    )
  }

  const active = selected === path
  const base = path.includes('/') ? path.split('/').pop() ?? path : path

  return (
    <button
      type="button"
      style={pad}
      className={[
        'flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition',
        active ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]',
      ].join(' ')}
      onClick={() => onSelect(path)}
    >
      <span className="w-4 shrink-0" />
      <FileIcon node={node} />
      <span className="truncate">{base}</span>
    </button>
  )
}

export function DeploymentsPage() {
  const location = useLocation()
  const fromRun = Boolean(
    (location.state as { fromRun?: boolean } | null)?.fromRun,
  )

  const [files, setFiles] = useState<{ name: string; size: number }[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [openFolders, setOpenFolders] = useState(() => new Set(['output']))
  const [selectedPath, setSelectedPath] = useState('output')
  const [preview, setPreview] = useState(FALLBACK_README)

  const tree: FsNode[] = useMemo(() => {
    if (files.length === 0) {
      return [
        {
          name: 'output',
          kind: 'folder',
          children: [],
        },
      ]
    }
    return [
      {
        name: 'output',
        kind: 'folder',
        children: files.map((f) => ({
          name: f.name,
          kind: 'file' as const,
          lang: inferLang(f.name),
        })),
      },
    ]
  }, [files])

  const refreshFiles = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const { files: next, error } = await fetchOutputListWithRetry()
      setFiles(next)
      setListError(error ?? null)
      if (next.length > 0) {
        const firstMd = next.find((f) => f.name.endsWith('.md'))
        const pick = firstMd?.name ?? next[0].name
        setSelectedPath(`output/${pick}`)
      } else {
        setSelectedPath('output')
        setPreview(
          error
            ? `Could not load output listing.\n\n${error}\n\nRun **npm run api** from the repo root, then refresh this page.`
            : FALLBACK_README,
        )
      }
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshFiles()
  }, [refreshFiles])

  useEffect(() => {
    if (!fromRun) return
    const t = window.setTimeout(() => refreshFiles(), 400)
    const t2 = window.setTimeout(() => refreshFiles(), 2500)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(t2)
    }
  }, [fromRun, refreshFiles])

  const onSelect = useCallback((path: string) => {
    setSelectedPath(path)
  }, [])

  useEffect(() => {
    const basename = selectedPath.includes('/')
      ? selectedPath.split('/').pop() ?? ''
      : selectedPath
    if (!basename || basename === 'output') return
    let cancelled = false
    ;(async () => {
      setPreviewLoading(true)
      const text = await fetchOutputContent(basename)
      if (!cancelled) setPreview(text ?? FALLBACK_README)
      setPreviewLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPath, files])

  const toggle = useCallback((path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const rows = useMemo(
    () =>
      tree.map((n) => (
        <TreeRow
          key={n.name}
          node={n}
          depth={0}
          selected={selectedPath}
          onSelect={onSelect}
          openFolders={openFolders}
          toggle={toggle}
        />
      )),
    [tree, selectedPath, onSelect, openFolders, toggle],
  )

  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  const totalKb = totalBytes > 0 ? (totalBytes / 1024).toFixed(1) : '—'

  const zipHref = outputDownloadAllUrl()
  const downloadDisabled = files.length === 0

  return (
    <div className="p-6 lg:p-8">
      {fromRun && (
        <div className="mx-auto mb-6 max-w-[1200px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Build finished — your generated files are in{' '}
          <code className="rounded bg-black/30 px-1 text-xs">output/</code>.
          Download the zip or browse files below.
        </div>
      )}

      <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2">
        <section className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#0f0b18]/95 p-8 text-center shadow-lg backdrop-blur-sm transition hover:border-violet-500/20">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-white">
            {listError
              ? 'Cannot reach the API'
              : files.length > 0
                ? 'Your app is ready!'
                : 'No output files yet'}
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/55">
            {listError ? (
              <>
                Deployments loads the list from{' '}
                <code className="text-white/75">/api/output/list</code> (proxied
                to port 8000).                 In the repo root run{' '}
                <code className="rounded bg-black/30 px-1 text-xs">
                  npm run stack
                </code>{' '}
                (API + Vite) or{' '}
                <code className="rounded bg-black/30 px-1 text-xs">
                  npm run api
                </code>{' '}
                in a separate terminal, wait for “Application startup complete”, then
                refresh this page.
              </>
            ) : files.length > 0 ? (
              <>
                Agents wrote deliverables into the{' '}
                <span className="text-white/80">output</span> folder. Download
                everything as a zip or open files in the explorer.
              </>
            ) : (
              <>
                The <span className="text-white/80">output/</span> folder is
                empty or the crew did not write files. Run a crew from Builders,
                then refresh — or open{' '}
                <code className="text-white/75">output/</code> in your repo in
                the file explorer.
              </>
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.gradio.app/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              Gradio docs
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={downloadDisabled ? undefined : zipHref}
              aria-disabled={downloadDisabled}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
                downloadDisabled
                  ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/35'
                  : 'bg-linear-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]',
              ].join(' ')}
              onClick={(e) => downloadDisabled && e.preventDefault()}
            >
              <Download className="h-4 w-4" />
              Download all (zip)
            </a>
          </div>
          <p className="mt-4 text-xs text-white/40">
            API base: <span className="font-mono">{apiBase() || 'same-origin /api'}</span>
          </p>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f0b18]/95 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white">Build Metrics</h3>
          <div className="mt-5 space-y-3">
            {[
              ['Output files', listLoading ? '…' : String(files.length)],
              ['Total size', `${totalKb} KB`],
              [
                'Status',
                listError
                  ? 'API ERROR'
                  : files.length
                    ? 'READY'
                    : 'EMPTY',
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-xl bg-black/25 px-4 py-3 ring-1 ring-white/[0.05]"
              >
                <span className="text-sm text-white/55">{k}</span>
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  {k === 'Status' && files.length > 0 && !listError && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgb(52_211_153_/0.9)]" />
                    </span>
                  )}
                  {v}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f0b18]/95 shadow-lg backdrop-blur-sm lg:col-span-1">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-white/45">
              File Explorer
            </span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Refresh"
              onClick={() => refreshFiles()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-2">
            {listLoading ? (
              <p className="px-2 py-4 text-sm text-white/45">Loading files…</p>
            ) : (
              rows
            )}
            {!listLoading && files.length === 0 && (
              <p className="border-t border-white/[0.06] px-2 py-3 text-xs leading-relaxed text-white/45">
                {listError ? (
                  <>
                    <span className="text-rose-300/95">{listError}</span> Start the
                    API from the repo root:{' '}
                    <code className="rounded bg-black/40 px-1">npm run api</code> — or
                    run UI + API together:{' '}
                    <code className="rounded bg-black/40 px-1">npm run stack</code>.
                    Then{' '}
                    <a
                      href="http://127.0.0.1:8000/api/health"
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-300 underline"
                    >
                      open /api/health
                    </a>{' '}
                    (should return JSON). Use the refresh control above.
                  </>
                ) : (
                  <>
                    No files in <code className="text-white/70">output/</code> yet.
                    Run a crew from Builders, then refresh — or confirm the API can read
                    the repo <code className="text-white/70">output/</code> folder.
                  </>
                )}
              </p>
            )}
          </div>
          {files.length > 0 && (
            <div className="border-t border-white/[0.06] px-3 py-2 text-xs text-white/45">
              Per-file download:
              <ul className="mt-2 space-y-1">
                {files.slice(0, 12).map((f) => (
                  <li key={f.name}>
                    <a
                      href={outputFileUrl(f.name)}
                      download={f.name}
                      className="text-violet-300 hover:underline"
                    >
                      {f.name}
                    </a>
                    <span className="text-white/35">
                      {' '}
                      ({Math.max(1, Math.round(f.size / 1024))} KB)
                    </span>
                  </li>
                ))}
                {files.length > 12 && (
                  <li className="text-white/35">…and more — use zip</li>
                )}
              </ul>
            </div>
          )}
        </section>

        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0b18]/95 shadow-lg backdrop-blur-sm lg:col-span-1">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/85" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/85" />
            </div>
            <span className="font-mono text-xs text-white/75">
              {selectedPath.includes('/')
                ? selectedPath.split('/').pop()
                : selectedPath}
            </span>
            <span className="w-6" />
          </div>
          <div className="readme-md flex-1 overflow-y-auto p-5">
            {previewLoading ? (
              <p className="text-sm text-white/45">Loading preview…</p>
            ) : selectedPath.endsWith('.md') ? (
              <ReactMarkdown>{preview}</ReactMarkdown>
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/85">
                {preview}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
