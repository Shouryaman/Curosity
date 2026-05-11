import { useEffect, useMemo, useRef } from 'react'
import {
  Check,
  Cloud,
  Hourglass,
  Loader2,
  MoreHorizontal,
  Play,
} from 'lucide-react'
import { type PhasePayload, useCrewRun } from '../context/CrewRunContext'
import { apiBase } from '../lib/api'

type StepStatus = 'completed' | 'running' | 'pending'

type Step = {
  title: string
  badge: string
  status: StepStatus
  detail: string
}

const STEP_TEMPLATE: Omit<Step, 'status' | 'badge'>[] = [
  {
    title: 'Requirement Analysis',
    detail: 'Engineering Lead gathers requirements and constraints.',
  },
  {
    title: 'Engineering Planning',
    detail: 'Architecture and module shape defined for implementation.',
  },
  {
    title: 'Backend Development',
    detail: 'Backend engineer implements the Python module.',
  },
  {
    title: 'Frontend Development',
    detail: 'Gradio demo wiring against the backend.',
  },
  {
    title: 'Deployment',
    detail: 'Tests and verification before handoff.',
  },
]

function stepsFromPhase(phase: PhasePayload | null): Step[] {
  return STEP_TEMPLATE.map((t, i) => {
    let status: StepStatus = 'pending'
    if (phase) {
      if (i <= phase.completed_up_to) status = 'completed'
      else if (phase.current !== null && i === phase.current)
        status = 'running'
    }
    const badge =
      status === 'completed'
        ? 'COMPLETED'
        : status === 'running'
          ? 'RUNNING'
          : 'PENDING'
    const detail =
      status === 'running' && phase?.operation ? phase.operation : t.detail
    return {
      title: t.title,
      detail,
      status,
      badge,
    }
  })
}

function pctFromPhase(phase: PhasePayload | null): number {
  if (!phase) return 3
  if (phase.completed_up_to >= 4 && phase.current === null) return 100
  const base = 12 + Math.max(0, phase.completed_up_to + 1) * 16
  return Math.min(94, base + (phase.current !== null ? 6 : 0))
}

function LogLineView({
  line,
}: {
  line: { text: string; tone?: 'default' | 'success' | 'accent' | 'muted' }
}) {
  const tone = line.tone ?? 'default'
  const cls =
    tone === 'success'
      ? 'text-emerald-400/95'
      : tone === 'accent'
        ? 'text-fuchsia-300/95'
        : tone === 'muted'
          ? 'text-white/45'
          : 'text-white/75'

  if (!line.text) return <div className="h-2" />

  return (
    <div className={`font-mono text-[11px] leading-relaxed sm:text-xs ${cls}`}>
      {line.text}
    </div>
  )
}

export function BuildersPage() {
  const {
    phase,
    logs,
    runMode,
    error,
    requirements,
    setRequirements,
    moduleName,
    setModuleName,
    className,
    setClassName,
    openaiConfigured,
    startCrew,
  } = useCrewRun()

  const scrollRef = useRef<HTMLDivElement>(null)

  const steps = useMemo(() => stepsFromPhase(phase), [phase])
  const pct = useMemo(() => pctFromPhase(phase), [phase])

  const operation = useMemo(() => {
    if (phase?.operation) return phase.operation
    if (runMode === 'idle') return 'Waiting to start...'
    return 'Working...'
  }, [phase, runMode])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [logs])

  const apiHint = apiBase() || '(same origin /api via Vite proxy → http://127.0.0.1:8000)'

  const busy = runMode === 'starting' || runMode === 'streaming'
  const phaseStillRunning =
    runMode === 'done' &&
    phase != null &&
    phase.current !== null

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="flex-1 border-b border-white/[0.06] p-6 lg:border-r lg:border-b-0 lg:p-10">
        <div className="mx-auto max-w-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Building your app...
            </h1>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startCrew()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {runMode === 'starting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run crew
            </button>
          </div>

          <p className="mt-2 text-xs text-white/40">
            API:{' '}
            <span className="font-mono text-white/55">{apiHint}</span>
          </p>

          {openaiConfigured === false && (
            <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <strong className="font-semibold">OPENAI_API_KEY</strong> is not
              set. Copy{' '}
              <code className="rounded bg-black/30 px-1 text-xs">.env.example</code>{' '}
              to{' '}
              <code className="rounded bg-black/30 px-1 text-xs">.env</code> in
              the project root and add your key, then restart the API.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                Module file
              </span>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                disabled={busy}
                placeholder="calc.py"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/90 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
              />
              <p className="mt-1 text-[11px] text-white/40">
                Written to <code className="text-white/55">output/</code>; must
                must match this filename (e.g. calc.py).
              </p>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                Primary class
              </span>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={busy}
                placeholder="Main"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/90 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
              />
              <p className="mt-1 text-[11px] text-white/40">
                Used in CrewAI task templates alongside requirements.
              </p>
            </label>
          </div>

          <label className="mt-6 block">
            <span className="text-xs font-medium uppercase tracking-wide text-white/45">
              Requirements
            </span>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              disabled={busy}
              rows={5}
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
            />
          </label>

          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
            <strong className="text-white/55">Note:</strong> Each agent calls the
            LLM several times; backend/code steps can take a few minutes. If logs
            keep updating, the run is still active.
          </p>

          <div className="mt-8">
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-linear-to-r from-violet-600 to-indigo-400 transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-white/55">
              Current Operation:{' '}
              <span className="text-white/85">{operation}</span>
            </p>
          </div>

          <div className="relative mt-10 space-y-0 pl-2">
            <span className="absolute top-2 bottom-4 left-[15px] w-px bg-white/10" />
            <ul className="space-y-8">
              {steps.map((step) => (
                <li key={step.title} className="relative flex gap-4 pl-8">
                  <span className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-[#12101c]">
                    {step.status === 'completed' && (
                      <Check className="h-4 w-4 text-emerald-400" />
                    )}
                    {step.status === 'running' && (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    )}
                    {step.status === 'pending' &&
                      (step.title === 'Deployment' ? (
                        <Cloud className="h-4 w-4 text-white/35" />
                      ) : (
                        <Hourglass className="h-4 w-4 text-white/35" />
                      ))}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">
                        {step.title}
                      </span>
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
                          step.status === 'completed' &&
                            'border border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
                          step.status === 'running' &&
                            'border border-violet-500/35 bg-violet-500/15 text-violet-200',
                          step.status === 'pending' &&
                            'border border-white/10 bg-white/[0.04] text-white/45',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {step.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/50">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 bg-[#0b0814]/80 lg:w-[420px] lg:border-l lg:border-white/[0.06]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-white/40">
            Agent-runtime-logs
          </span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#050308] shadow-inner">
            <div className="flex gap-1.5 border-b border-white/[0.06] px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <div
              ref={scrollRef}
              className="max-h-[min(420px,50vh)] space-y-1 overflow-y-auto p-4 lg:max-h-[calc(100vh-220px)]"
            >
              {logs.map((line, i) => (
                <LogLineView key={`${i}-${line.text.slice(0, 24)}`} line={line} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] px-3 py-2 font-mono text-[10px] text-white/45">
              <span
                className={
                  runMode === 'streaming' || phaseStillRunning
                    ? 'text-emerald-400/90'
                    : runMode === 'done'
                      ? 'text-violet-300/90'
                      : runMode === 'error'
                        ? 'text-rose-400/90'
                        : 'text-white/45'
                }
              >
                ●{' '}
                {runMode === 'streaming'
                  ? 'LIVE SSE'
                  : phaseStillRunning
                    ? 'FINISHING'
                    : runMode === 'done'
                      ? 'COMPLETE'
                      : runMode === 'error'
                        ? 'ERROR'
                        : 'IDLE'}
              </span>
              <span>UTC {new Date().toISOString().slice(11, 19)}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
