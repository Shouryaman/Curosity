import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { pathname } = useLocation()
  const isBuilders = pathname.startsWith('/builders')

  return (
    <div className="flex min-h-svh flex-col bg-[#070510]">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          brandTitle={isBuilders ? 'Curosity Engine' : 'Curosity'}
          brandIcon={isBuilders ? 'bot' : 'rocket'}
        />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Footer variant="compact" />
    </div>
  )
}
