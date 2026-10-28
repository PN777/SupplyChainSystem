import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type Props = {
  title: string
  onRefresh: () => void
  children: ReactNode
}

export function MainLayout({ title, onRefresh, children }: Props) {
  return (
    <div className="theme-shell flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-hidden">
        <Topbar title={title} onRefresh={onRefresh} />
        <main className="min-w-0 px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-7 xl:px-8">
          <div className="page-frame">{children}</div>
        </main>
      </div>
    </div>
  )
}
