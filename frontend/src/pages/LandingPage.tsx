import { useEffect, useState } from 'react'
import {
  Bot,
  Brackets,
  CheckCircle2,
  ClipboardPaste,
  Database,
  Globe,
  Rocket,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { TopNav } from '../components/layout/TopNav'
import { Footer } from '../components/layout/Footer'

const TERMINAL_LINES = [
  '> git commit -m "Initialize agent pipeline"',
  '[SYSTEM] Spawning Python Engineer Instance #8284...',
  '> Task: Architecture design in progress (84%)',
  '[DEBUG] Resource allocation stable. Memory usage: 1.2GB',
]

export function LandingPage() {
  const [focused, setFocused] = useState(false)
  const [typed, setTyped] = useState('')
  const full =
    'Agent: Engineering Lead initializing project workspace...'

  useEffect(() => {
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTyped(full.slice(0, i))
      if (i >= full.length) window.clearInterval(id)
    }, 28)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-[#070510]">
      <TopNav />

      <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(139 92 246 / 0.35), transparent 55%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Design at the speed of{' '}
            <span className="bg-linear-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
              AI
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/65 sm:text-lg">
            Transform ideas into full-stack applications instantly using AI
            agents. Engineering intelligence for the next generation of
            builders.
          </p>

          <div
            className={[
              'group mx-auto mt-10 max-w-2xl rounded-2xl border bg-[#0f0b18]/90 p-4 shadow-xl backdrop-blur-md transition-[box-shadow,border-color] duration-300 sm:p-5',
              focused
                ? 'border-violet-500/40 shadow-[0_0_48px_rgb(168_85_247_/0.22)]'
                : 'border-white/10 animate-glow-pulse',
            ].join(' ')}
          >
            <textarea
              rows={4}
              placeholder="Describe the app you want to build..."
              className="w-full resize-none rounded-xl border-0 bg-transparent text-left text-sm text-white placeholder:text-white/35 focus:ring-0 focus:outline-none sm:text-base"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <div className="flex gap-2 text-white/45">
                <button
                  type="button"
                  className="rounded-lg p-2 transition hover:bg-white/10 hover:text-violet-300"
                  aria-label="Attach"
                >
                  <ClipboardPaste className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 transition hover:bg-white/10 hover:text-violet-300"
                  aria-label="Web"
                >
                  <Globe className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 transition hover:bg-white/10 hover:text-violet-300"
                  aria-label="Code"
                >
                  <Brackets className="h-5 w-5" />
                </button>
              </div>
              <Link
                to="/builders"
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-violet-600 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02] hover:shadow-violet-500/45 active:scale-[0.98]"
              >
                <Rocket className="h-4 w-4" />
                Build My App
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0b18]/80 px-4 py-3 font-mono text-xs text-white/80 backdrop-blur-sm sm:text-sm">
            <Bot className="h-4 w-4 text-violet-400" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 sm:text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
            </span>
            <span className="text-left text-white/70">{typed}</span>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2 md:gap-5">
          <article className="group md:col-span-2 md:row-span-1 rounded-2xl border border-white/[0.08] bg-[#0f0b18]/90 p-6 shadow-lg backdrop-blur-sm transition hover:border-violet-500/25">
            <h2 className="text-lg font-semibold text-white">
              Live Agent Execution
            </h2>
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-emerald-400/95 sm:text-xs">
              {TERMINAL_LINES.map((line) => (
                <div key={line}>{line}</div>
              ))}
              <span className="inline-block h-3 w-2 animate-pulse bg-emerald-400/80 align-middle" />
            </div>
            <p className="mt-4 text-sm text-white/55">
              Watch your application come to life line-by-line as a swarm of
              autonomous agents collaborate on your vision.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-[#0f0b18]/90 p-6 shadow-lg backdrop-blur-sm transition hover:border-violet-500/25 md:row-span-1">
            <Database className="h-8 w-8 text-violet-400" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Data Sovereignty
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Your code, your data. Local-first architecture ensures full control
              over your intellectual property.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-[#0f0b18]/90 p-6 shadow-lg backdrop-blur-sm transition hover:border-violet-500/25">
            <Sparkles className="h-8 w-8 text-blue-400" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Universal Deploy
            </h2>
            <p className="mt-2 text-sm text-white/55">
              One-click deployments to Vercel, AWS, or your own private cloud
              infrastructure.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-[#0f0b18]/90 p-6 shadow-lg backdrop-blur-sm transition hover:border-violet-500/25 md:col-span-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="h-36 flex-1 rounded-xl bg-linear-to-br from-violet-900/40 via-[#1a1530] to-blue-900/30 ring-1 ring-white/10 lg:h-28" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  Production Ready Code
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  Clean, documented, and type-safe code that scales with your
                  business needs.
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <Footer variant="full" />
    </div>
  )
}
