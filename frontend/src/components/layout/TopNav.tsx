import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Platform', end: true },
  { to: '/builders', label: 'Builders' },
  { to: '/deployments', label: 'Deployments', hidden: true },
  { to: '#docs', label: 'Docs' },
  { to: '#pricing', label: 'Pricing' },
] as const

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070510]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="bg-linear-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
            Curosity
          </span>
        </NavLink>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {nav
            .filter((item) => !('hidden' in item && item.hidden))
            .map((item) =>
              item.to.startsWith('#') ? (
                <a
                  key={item.label}
                  href={item.to}
                  className="text-sm text-white/75 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    [
                      'relative text-sm transition-colors',
                      isActive
                        ? 'text-white after:absolute after:-bottom-[1.35rem] after:left-0 after:right-0 after:h-px after:bg-white/90'
                        : 'text-white/75 hover:text-white',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            className="hidden text-sm text-white/80 transition hover:text-white sm:block"
          >
            Sign In
          </button>
          <NavLink
            to="/builders"
            className="rounded-full bg-linear-to-r from-violet-500 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition hover:scale-[1.02] hover:shadow-violet-500/40 active:scale-[0.98]"
          >
            Get Started
          </NavLink>
          <button
            type="button"
            className="hidden h-9 w-9 shrink-0 rounded-full border border-white/20 bg-linear-to-br from-violet-600/40 to-blue-600/30 sm:block"
            aria-label="Profile"
          />
        </div>
      </div>
    </header>
  )
}
