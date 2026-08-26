import { Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import Contacts from '@/pages/Contacts'
import AddContact from '@/pages/AddContact'
import Talk from '@/pages/Talk'
import Messages from '@/pages/Messages'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'
import Privacy from '@/pages/Privacy'
import Blocked from '@/pages/Blocked'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import RequireAuth from '@/components/RequireAuth'
import GuestOnly from '@/components/GuestOnly'
import UpdateToast from '@/components/UpdateToast'

// Arborescence des routes — correspond a la section 17 du prompt produit.
// Phase 2 : garde d'authentification branchee. /login et /register sont
// publiques (via GuestOnly) ; toutes les autres routes exigent une session
// (via RequireAuth).
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/contacts" element={<RequireAuth><Contacts /></RequireAuth>} />
        <Route path="/contacts/add" element={<RequireAuth><AddContact /></RequireAuth>} />
        <Route path="/talk/:userId" element={<RequireAuth><Talk /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/privacy" element={<RequireAuth><Privacy /></RequireAuth>} />
        <Route path="/blocked" element={<RequireAuth><Blocked /></RequireAuth>} />
      </Routes>
      {/* Phase 10 : monte hors des routes pour rester visible quel que soit
          l'ecran (mise a jour / pret hors ligne peuvent survenir n'importe
          quand). */}
      <UpdateToast />
    </>
  )
}
