import { createServer } from 'node:http'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './env'
import { authRouter } from './modules/auth/auth.routes'
import { contactsRouter } from './modules/contacts/contacts.routes'
import { voiceMessagesRouter } from './modules/voice-messages/voice-messages.routes'
import { pushRouter } from './modules/push/push.routes'
import { messagesRouter } from './modules/messages/messages.routes'
import { errorHandler } from './middleware/errorHandler'
import { securityHeaders, apiRateLimit } from './middleware/security'
import { csrfProtection } from './middleware/csrfProtection'
import { initSocketServer } from './realtime/socket'

const app = express()
const API_PREFIX = '/api'

// Necessaire en production derriere un reverse proxy (Render, Railway,
// Nginx...) pour que `req.ip` reflete l'IP reelle du client plutot que
// celle du proxy — sans ca, tous les clients partageraient la meme entree
// dans les limiteurs de debit ci-dessous (section 13 : rate limiting).
if (env.isProduction) {
  app.set('trust proxy', 1)
}

app.use(securityHeaders)

// credentials: true est necessaire pour que le navigateur envoie/recoive le
// cookie de session cross-origin (frontend sur :5173, backend sur :4000).
// allowedHeaders liste explicitement X-Requested-With : requis par
// csrfProtection ci-dessous, sinon le navigateur bloquerait la requete au
// stade du preflight CORS avant meme d'atteindre ce middleware.
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  }),
)
app.use(cookieParser())
app.use(express.json({ limit: '10kb' })) // limite basique contre les payloads abusifs
app.use(apiRateLimit)
app.use(csrfProtection)

app.get(`${API_PREFIX}/healthz`, (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(`${API_PREFIX}/auth`, authRouter)
app.use(`${API_PREFIX}/contacts`, contactsRouter)
app.use(`${API_PREFIX}/voice-messages`, voiceMessagesRouter)
app.use(`${API_PREFIX}/push`, pushRouter)
app.use(`${API_PREFIX}/messages`, messagesRouter)

// Doit rester apres toutes les routes.
app.use(errorHandler)

// Phase 5 : un serveur HTTP explicite est necessaire pour que Socket.IO et
// Express ecoutent sur le meme port (le WebSocket fait un upgrade de la
// connexion HTTP existante, il ne s'agit pas d'un second serveur separe).
const httpServer = createServer(app)
initSocketServer(httpServer)

httpServer.listen(env.port, '0.0.0.0', () => {
  console.log(`[server] Talkie API + WebSocket demarres sur le port ${env.port}`)
})
