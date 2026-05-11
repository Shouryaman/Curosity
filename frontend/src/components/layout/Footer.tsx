import { Link } from 'react-router-dom'

type Props = {
  variant?: 'full' | 'compact'
}

const links = [
  ['Privacy Policy', '#'],
  ['Terms of Service', '#'],
  ['Security', '#'],
  ['Status', '#'],
  ['GitHub', 'https://github.com'],
]

export function Footer({ variant = 'full' }: Props) {
  const showStatus = variant === 'full'

  return (
    <footer className="border-t border-white/[0.06] bg-[#06040d]/90 py-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link to="/" className="text-sm font-semibold text-white">
            Curosity AI
          </Link>
          <p className="mt-2 max-w-md font-mono text-[10px] uppercase tracking-wider text-white/40 sm:text-[11px]">
            © {new Date().getFullYear()} Curosity AI Intelligence. Built for the
            future of engineering.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(showStatus ? links : links.filter(([l]) => l !== 'Status')).map(
            ([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-xs text-white/55 transition hover:text-violet-300"
              >
                {label}
              </a>
            ),
          )}
        </div>
      </div>
    </footer>
  )
}
