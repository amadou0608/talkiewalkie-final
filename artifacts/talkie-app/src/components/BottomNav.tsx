import { NavLink } from 'react-router-dom'
import { Radio, Users, CircleDot, User } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'Accueil', icon: Radio, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users, end: false },
  { to: '/status', label: 'Statut', icon: CircleDot, end: false },
  { to: '/profile', label: 'Profil', icon: User, end: false },
]

// Navigation basse, zone tactile large — usage a une main sur mobile.
export default function BottomNav() {
  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-ink/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-transmit' : 'text-paperDim hover:text-paper'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
