import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  apiBase,
  consumeSseStream,
  fetchOutputListWithRetry,
  outputFileUrl,
  startRun,
} from '../lib/api'

export type LogTone = 'default' | 'success' | 'accent' | 'muted'

export type LogLine = { text: string; tone?: LogTone }

export type PhasePayload = {
  completed_up_to: number
  current: number | null
  operation: string
}

export type RunMode = 'idle' | 'starting' | 'streaming' | 'done' | 'error'

/** Filenames / class name passed to CrewAI task templates (must match your prompt). */
export const DEFAULT_MODULE_NAME = 'module.py'
export const DEFAULT_CLASS_NAME = 'Main'

export const DEFAULT_REQUIREMENTS = `
Describe what to build in plain English. The module file and primary class below are sent to the crew as the target API shape.

Example: A four-function calculator: add, subtract, multiply, divide for two floats; divide raises ValueError on division by zero. Use only the Python standard library in the core module.
`.trim()

type CrewRunContextValue = {
  phase: PhasePayload | null
  logs: LogLine[]
  runMode: RunMode
  error: string | null
  requirements: string
  setRequirements: (v: string) => void
  moduleName: string
  setModuleName: (v: string) => void
  className: string
  setClassName: (v: string) => void
  openaiConfigured: boolean | null
  startCrew: () => Promise<void>
}

const CrewRunContext = createContext<CrewRunContextValue | null>(null)

export function CrewRunProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const runOutcome = useRef<{ ok: boolean; runId: string | null }>({
    ok: false,
    runId: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<PhasePayload | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([
    {
      text: 'Press “Run crew” to start the EngineeringTeam via FastAPI (SSE).',
      tone: 'muted',
    },
  ])
  const [runMode, setRunMode] = useState<RunMode>('idle')
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS)
  const [moduleName, setModuleName] = useState(DEFAULT_MODULE_NAME)
  const [className, setClassName] = useState(DEFAULT_CLASS_NAME)
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(
    null,
  )

  const appendLog = useCallback((text: string, tone?: LogTone) => {
    setLogs((prev) => [...prev.slice(-400), { text, tone }])
  }, [])

  const handleSseMessage = useCallback(
    (raw: string) => {
      try {
        const ev = JSON.parse(raw) as Record<string, unknown>
        const t = ev.type as string
        if (t === 'phase') {
          setPhase({
            completed_up_to: ev.completed_up_to as number,
            current: ev.current as number | null,
            operation: String(ev.operation ?? ''),
          })
        } else if (t === 'log') {
          appendLog(String(ev.text ?? ''), 'default')
        } else if (t === 'task') {
          const agent = String(ev.agent ?? '')
          const summary = String(ev.summary ?? '').slice(0, 280)
          appendLog(`Task complete — ${agent}`, 'success')
          if (summary) appendLog(summary, 'muted')
        } else if (t === 'step') {
          appendLog(String(ev.detail ?? ''), 'muted')
        } else if (t === 'done') {
          runOutcome.current.ok = true
          appendLog('Crew kickoff finished.', 'accent')
          const preview = ev.result_preview as string | undefined
          if (preview) appendLog(preview, 'muted')
          setRunMode('done')
        } else if (t === 'error') {
          runOutcome.current.ok = false
          appendLog(`Error: ${String(ev.message ?? '')}`, 'accent')
          setError(String(ev.message ?? 'Unknown error'))
          setRunMode('error')
        } else if (t === 'end') {
          abortRef.current?.abort()
        }
      } catch {
        appendLog(`(parse error) ${raw.slice(0, 120)}`, 'muted')
      }
    },
    [appendLog],
  )

  const startCrew = useCallback(async () => {
    setError(null)
    runOutcome.current = { ok: false, runId: null }
    setRunMode('starting')
    setLogs([
      {
        text: `Starting run → module ${moduleName}, class ${className}…`,
        tone: 'accent',
      },
    ])
    setPhase(null)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const { run_id } = await startRun({
        requirements,
        module_name: moduleName.trim() || DEFAULT_MODULE_NAME,
        class_name: className.trim() || DEFAULT_CLASS_NAME,
      })
      runOutcome.current.runId = run_id
      setRunMode('streaming')

      await consumeSseStream(
        run_id,
        (line) => handleSseMessage(line),
        ac.signal,
      )
      // Only the SSE `done` event sets runMode to `done`. Do not mark COMPLETE
      // if the stream dropped early (proxy timeout, API restart) while phase still shows RUNNING.
      setRunMode((m) => {
        if (m !== 'streaming') return m
        if (runOutcome.current.ok) return 'done'
        appendLog(
          'Stream closed before the crew sent a final "done" event — results may be incomplete. Retry with a stable npm run api session.',
          'accent',
        )
        setError('Stream ended before crew completion')
        return 'error'
      })

      if (runOutcome.current.ok) {
        const listed = await fetchOutputListWithRetry(10, 450)
        if (listed.files.length > 0) {
          appendLog(
            'Output files are on disk — open Deployments or use these paths (same origin as the app):',
            'success',
          )
          for (const f of listed.files) {
            const rel = outputFileUrl(f.name)
            appendLog(`  ${f.name} (${f.size} B) → ${rel}`, 'muted')
          }
        } else if (listed.error) {
          appendLog(
            `Could not list output/ yet: ${listed.error} Keep this terminal’s npm run api running, then refresh Deployments.`,
            'accent',
          )
        } else {
          appendLog(
            'Listing returned no files in output/. If the crew wrote tasks, check the API terminal and repo output/ on disk.',
            'muted',
          )
        }
        await new Promise((r) => setTimeout(r, 200))
        appendLog(
          'Files are under output/ — open Deployments in the sidebar to list or zip-download (optional).',
          'muted',
        )
        if (import.meta.env.VITE_NAVIGATE_AFTER_RUN === '1') {
          navigate('/deployments', {
            replace: false,
            state: {
              fromRun: true,
              runId: runOutcome.current.runId,
            },
          })
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      appendLog(`Failed: ${msg}`, 'accent')
      setRunMode('error')
    }
  }, [
    appendLog,
    className,
    handleSseMessage,
    moduleName,
    navigate,
    requirements,
  ])

  useEffect(() => {
    const base = apiBase()
    fetch(`${base}/api/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { openai_configured?: boolean } | null) => {
        if (data && typeof data.openai_configured === 'boolean') {
          setOpenaiConfigured(data.openai_configured)
        }
      })
      .catch(() => setOpenaiConfigured(null))
  }, [])

  const value = useMemo<CrewRunContextValue>(
    () => ({
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
    }),
    [
      phase,
      logs,
      runMode,
      error,
      requirements,
      moduleName,
      className,
      openaiConfigured,
      startCrew,
    ],
  )

  return (
    <CrewRunContext.Provider value={value}>{children}</CrewRunContext.Provider>
  )
}

export function useCrewRun(): CrewRunContextValue {
  const ctx = useContext(CrewRunContext)
  if (!ctx) {
    throw new Error('useCrewRun must be used within CrewRunProvider')
  }
  return ctx
}
