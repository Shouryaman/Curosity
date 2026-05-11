import { NavLink } from 'react-router-dom'
import {
  Bot,
  BookOpen,
  FolderOpen,
  LayoutGrid,
  LifeBuoy,
  Rocket,
  Settings,
} from 'lucide-react'

export type SidebarActive =
  | 'dashboard'
  | 'agents'
  | 'deployments'
  | 'resources'
  | 'settings'

type Props = {
  brandTitle?: string
  brandIcon?: 'rocket' | 'bot'
}

const items: {
  id: SidebarActive
  to: string
  label: string
  Icon: typeof Bot
}[] = [
  { id: 'dashboard', to: '/dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { id: 'agents', to: '/builders', label: 'Agents', Icon: Bot },
  { id: 'deployments', to: '/deployments', label: 'Deployments', Icon: Rocket },
  { id: 'resources', to: '/resources', label: 'Resources', Icon: FolderOpen },
  { id: 'settings', to: '/settings', label: 'Settings', Icon: Settings },
]

export function Sidebar({
  brandTitle = 'Curosity',
  brandIcon = 'rocket',
}: Props) {
  const HeaderIcon = brandIcon === 'bot' ? Bot : Rocket

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0814] py-5">
      <div className="flex items-center gap-3 px-4 pb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/30">
          <HeaderIcon className="h-5 w-5 text-violet-300" aria-hidden />
        </div>
        <div>
          <div className="font-semibold text-white">{brandTitle}</div>
          <div className="font-mono text-[11px] text-white/40">v2.4.0-stable</div>
        </div>
      </div>

      <NavLink
        to="/builders"
        className="mx-3 mb-6 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 active:scale-[0.99]"
      >
        + New Project
      </NavLink>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {items.map(({ id, to, label, Icon }) => (
          <NavLink key={id} to={to}>
            {({ isActive }) => (
              <span
                className={[
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-violet-500/15 text-white'
                    : 'text-white/65 hover:bg-white/[0.04] hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute top-1 right-0 bottom-1 w-0.5 rounded-l bg-violet-400" />
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/[0.06] px-2 pt-4">
        <a
          href="#docs"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white"
        >
          <BookOpen className="h-[18px] w-[18px]" />
          Documentation
        </a>
        <a
          href="#support"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white"
        >
          <LifeBuoy className="h-[18px] w-[18px]" />
          Support
        </a>
      </div>
    </aside>
  )
}
