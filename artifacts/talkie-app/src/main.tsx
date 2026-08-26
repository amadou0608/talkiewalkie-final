import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ContactsProvider } from '@/context/ContactsContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ContactsProvider>
          <App />
        </ContactsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
