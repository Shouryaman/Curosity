import { Link } from 'react-router-dom'

type Props = {
  title: string
  hint?: string
}

export function PlaceholderPage({ title, hint }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {hint && <p className="max-w-md text-sm text-white/55">{hint}</p>}
      <Link
        to="/"
        className="text-sm font-medium text-violet-300 hover:text-violet-200 hover:underline"
      >
        Back to platform
      </Link>
    </div>
  )
}
