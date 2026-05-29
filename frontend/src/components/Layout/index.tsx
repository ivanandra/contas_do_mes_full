import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Tour from '@/components/Onboarding/Tour'
import { useAuthStore } from '@/store/auth'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user && user.tour_completed === false) {
      setShowTour(true)
    }
  }, [user])

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {showTour && <Tour onClose={() => setShowTour(false)} />}
    </div>
  )
}
