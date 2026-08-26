# Talkie — talkie-walkie Internet (PWA)

Communication vocale push-to-talk entre deux utilisateurs, sans limite de distance,
via WebRTC. Installable comme application sur Android (Chrome → Ajouter a l'ecran
d'accueil).

Ce depot contient deux projets independants :

- **`talkie-app/`** (ce dossier) — le frontend (React + Vite + PWA).
- **`backend/`** — l'API (Node.js + Express + PostgreSQL), a la racine du depot,
  a cote de `talkie-app/`.

## Etat actuel : Phase 12 (terminee)

Phases acquises : 1 (frontend mobile-first, donnees fictives), 2 (inscription/
connexion reelles), 3 (PostgreSQL + `users`), 4 (contacts cote serveur), 5
(WebSocket + presence en ligne), 6 (audio temps reel via WebRTC), 7
(verrouillage Push-to-Talk), 8 (messages vocaux hors ligne), 9 (notifications
Web Push), 10 (PWA installable), 11 (securite et tests), 12 (deploiement).
Voir la section **Phase 12 — Deploiement** plus bas, et `DEPLOYMENT.md` a la
racine du depot pour le guide complet.

- `talkie-app/src/context/SettingsContext.tsx` (nouveau) : preferences
  propres a l'appareil, persistees en `localStorage` (et non en base — ce ne
  sont pas des donnees de compte). Expose `pttLockMode` / `setPttLockMode`,
  synchronise entre onglets via l'evenement `storage`.
- `talkie-app/src/pages/Settings.tsx` : le toggle *Mode verrouillage*, deja
  present visuellement depuis la Phase 1, est desormais branche sur
  `SettingsContext` au lieu d'un etat local factice — le reglage persiste
  entre les sessions et s'applique reellement a l'ecran `/talk`.
- `talkie-app/src/components/PTTButton.tsx` : deux modes d'interaction
  distincts selon `lockMode` :
  - **Maintenir** (par defaut) : `pointerdown` demarre, `pointerup` /
    `pointerleave` / `pointercancel` arrete — comportement de la Phase 6,
    desormais protege par un verrou (`heldRef`) empechant un deuxieme
    `pointerdown` (multi-touch) de redeclencher `onStart` pendant une
    transmission en cours.
  - **Verrouillage** : un seul `pointerdown` bascule entre parler / arreter.
    Un cooldown de 220 ms (`ACTION_COOLDOWN_MS`) absorbe les doubles
    evenements qu'un ecran tactile peut emettre pour un seul geste (section
    9 : "empecher les doubles connexions accidentelles"). Un badge cadenas
    et un texte d'aide ("Appuyez une fois pour parler" / "... pour
    arreter") rendent le mode explicite a l'ecran. Vibration courte
    (`navigator.vibrate`, si supportee) au demarrage/arret comme retour
    tactile.
- `talkie-app/src/hooks/useWebRTCCall.ts` : ecoute `visibilitychange` et
  coupe automatiquement la transmission si l'onglet passe en arriere-plan
  pendant qu'on parle. Necessaire surtout en mode verrouillage, ou rien
  d'autre (pas de relachement de doigt) ne stopperait sinon la piste micro.

Le double-appel accidentel au niveau reseau (deux offres WebRTC simultanees)
etait deja gere cote serveur depuis la Phase 6 (`activeCallPeer` +
`webrtc:busy`) ; cette phase ajoute la protection cote client, au niveau du
geste lui-meme.

- `backend/src/realtime/webrtc.signaling.ts` : signalisation WebRTC (offer/
  answer SDP, candidats ICE) relayee via le WebSocket existant (Phase 5) —
  le serveur ne transporte jamais l'audio lui-meme (section 3). Verifie que
  les deux utilisateurs sont bien des contacts acceptes (section 6) avant de
  relayer quoi que ce soit. Empeche les doubles connexions accidentelles
  (section 9) via un pairage `activeCallPeer` : un utilisateur ne peut etre
  engage qu'avec un seul correspondant a la fois — toute tentative
  concurrente recoit `webrtc:busy`. Une offre restee sans reponse 20s est
  automatiquement annulee (`webrtc:call-timeout`) pour ne pas laisser
  l'appelant bloque.
- `talkie-app/src/hooks/useWebRTCCall.ts` : remplace la simulation de la
  Phase 1 (`usePushToTalk.ts`, supprime). Demande l'acces au microphone
  (`getUserMedia`, avec echo cancellation / auto gain / reduction de bruit —
  section 19) et etablit la connexion `RTCPeerConnection` des l'ouverture de
  l'ecran `/talk/:userId` si le contact est en ligne. La piste audio
  demarre **desactivee** (`track.enabled = false`) : appuyer sur PTT ne fait
  que la reactiver et prevenir le correspondant (`webrtc:ptt-start` /
  `webrtc:ptt-stop`), sans renegociation SDP a chaque pression — necessaire
  pour rester reactif a l'usage. Le niveau du VU-metre (anneau du bouton
  PTT) vient desormais d'un vrai `AnalyserNode` sur le flux micro, plus
  d'une simulation aleatoire.
- `talkie-app/src/lib/webrtcConfig.ts` : construit la liste `iceServers`
  (STUN/TURN) a partir des variables d'environnement (section 3).
- `talkie-app/src/pages/Talk.tsx` : branche le vrai hook, affiche les etats
  micro refuse / erreur de connexion avec un bouton "Reessayer", et
  desactive le bouton PTT quand la transmission n'est pas possible.
- Regle de resolution de "glare" (les deux utilisateurs ouvrent l'ecran en
  meme temps) : l'identifiant utilisateur le plus petit (ordre lexical)
  envoie toujours l'offre ; l'autre repond. Deterministe, sans etat partage
  supplementaire a synchroniser.

Les phases suivantes (10 a 12) ajouteront l'empaquetage PWA complet
(service worker de cache), la securite/tests et le deploiement — voir la
section Roadmap. Les notifications Push (Phase 9) sont documentees plus bas.

## Phase 8 : messages vocaux hors ligne

Implemente la section 10 du cahier des charges : quand le destinataire est
hors ligne, l'appel temps reel (WebRTC) n'est pas possible — l'utilisateur
peut a la place enregistrer un vocal, qui est stocke cote serveur et
recuperable des que le destinataire se reconnecte.

- `backend/src/db/migrations/003_create_voice_messages.sql` (nouveau) :
  table `voice_messages` (section 4). `storage_path` est un chemin RELATIF
  interne au serveur, jamais une URL publique — voir la note de securite
  ci-dessous.
- `backend/src/modules/voice-messages/` (nouveau module) :
  - `storage.ts` : ecrit les fichiers audio sur le disque du serveur
    (`backend/uploads/voice-messages/`, exclu de git), sous un nom de
    fichier genere serveur (UUID) — jamais le nom fourni par le client
    (section 13 : validation stricte des entrees).
  - `voice-messages.schemas.ts` : validation zod (destinataire, duree) +
    constantes de limite (8 Mo, 180s — section 13 : "limitation des
    fichiers audio").
  - `voice-messages.service.ts` : cree un vocal (verifie que l'expediteur et
    le destinataire sont bien contacts, meme regle que la signalisation
    WebRTC de la Phase 6), liste la boite de reception, marque un vocal
    comme ecoute (idempotent).
  - `voice-messages.controller.ts` / `voice-messages.routes.ts` : `GET
    /voice-messages` (boite de reception), `POST /voice-messages`
    (`multipart/form-data` : champ `audio` + `receiverUserId` +
    `durationSec`, via `multer`), `GET /voice-messages/:id/audio` (lecture
    du fichier, avec support des requetes partielles `Range` pour une
    lecture fluide), `POST /voice-messages/:id/listened`.
  - **Securite (section 13/14)** : un vocal n'est jamais servi en fichier
    statique a une URL devinable. `GET /voice-messages/:id/audio` verifie
    systematiquement que le demandeur est l'expediteur ou le destinataire
    avant de streamer quoi que ce soit — sans ca, un lien partage ou devine
    donnerait acces au contenu prive d'un tiers.
- `backend/src/realtime/socket.ts` : ajoute `notifyUser()`, une notification
  temps reel generique (utilisee ici pour prevenir un destinataire deja
  connecte qu'un vocal vient d'arriver, sans attendre un prochain fetch
  REST — la vraie notification Web Push pour un destinataire hors ligne
  reste le perimetre de la Phase 9).
- `talkie-app/src/hooks/useVoiceRecorder.ts` (nouveau) : enregistrement via
  `MediaRecorder` (memes contraintes micro que l'appel temps reel — echo
  cancellation, auto gain, reduction de bruit, section 19), coupe
  automatiquement a 180s pour rester coherent avec la limite serveur.
- `talkie-app/src/lib/voiceMessagesApi.ts` (nouveau) : appels au backend
  (liste, envoi en `multipart/form-data`, marquage "ecoute") + construction
  de l'URL de lecture authentifiee.
- `talkie-app/src/pages/Talk.tsx` : quand le contact est hors ligne, propose
  desormais un vrai flux enregistrer / annuler / envoyer a la place du
  bouton non fonctionnel des phases precedentes.
- `talkie-app/src/pages/Messages.tsx` : remplace les donnees fictives
  (`data/mockData.ts`, supprime) par la vraie boite de reception, avec
  lecture audio (bouton play/pause) et rafraichissement temps reel via le
  WebSocket existant.

### Note sur la lecture audio et les cookies

L'element `<audio>` de `Messages.tsx` est cree avec `crossOrigin =
'use-credentials'` : sans cela, le navigateur n'envoie pas le cookie de
session sur la requete cross-origin vers `GET /voice-messages/:id/audio`, et
le serveur repondrait 401 (puisque cette route n'est justement jamais servie
en statique — voir la note de securite plus haut).

### Limites connues (Phase 8)

- Stockage disque local sur le serveur applicatif : ne survit pas a un
  redeploiement sans volume persistant, et ne fonctionne pas au-dela d'une
  seule instance serveur. Un stockage objet (S3-compatible ou equivalent)
  serait le choix naturel en production — le changement se limite a
  `storage.ts`, le reste du module n'en depend pas.
- La validation du fichier recu se limite au type MIME declare et a la
  taille — pas de verification approfondie du contenu (ex. via `ffprobe`)
  qu'une validation stricte en production voudrait probablement ajouter.
- Pas de pagination sur `GET /voice-messages` (limite fixe a 100 messages) :
  suffisant pour le MVP, a revoir si la boite de reception grossit.
- Pas de suppression d'un vocal cote utilisateur, ni de "vocaux envoyes" —
  hors perimetre de cette phase (le cahier des charges section 17 ne prevoit
  qu'une page `/messages`).
- `delivered_at` est fixe des l'ecriture en base (voir le commentaire en
  tete de `voice-messages.service.ts`) : ce n'est pas une confirmation de
  livraison au sens "l'appareil du destinataire l'a recu", qui necessiterait
  la Phase 9 (Web Push).

## Phase 9 : notifications Web Push

Implemente la section 11 du cahier des charges : quand un destinataire n'a
aucun onglet Talkie ouvert (aucun socket actif — voir `hasActiveSocket()`),
il recoit une vraie notification systeme via Web Push plutot qu'un evenement
temps reel qui n'atteindrait personne.

- `backend/src/db/migrations/004_create_devices.sql` (nouveau) : table
  `devices` (section 4). `push_token` stocke en JSONB l'objet
  `PushSubscription` complet renvoye par le navigateur (endpoint + cles
  `p256dh`/`auth`) — c'est la forme attendue telle quelle par `web-push`.
  `endpoint` est duplique en colonne texte (contrainte `UNIQUE(user_id,
  endpoint)`) pour eviter les doublons et permettre un nettoyage cible.
- `backend/src/modules/push/` (nouveau module) :
  - `push.schemas.ts` : validation zod de l'abonnement (endpoint + cles).
  - `push.repository.ts` : upsert idempotent d'un abonnement, suppression
    explicite (desabonnement) ou automatique (abonnement expire).
  - `push.service.ts` : configure `web-push` avec les cles VAPID
    (`WEB_PUSH_PUBLIC_KEY`/`WEB_PUSH_PRIVATE_KEY`) et expose
    `sendPushToUser()`. **Degradation gracieuse** : si les cles ne sont pas
    definies, le serveur demarre normalement mais le push reste desactive
    (avertissement au demarrage) — aucune autre phase n'en depend. Un
    abonnement qui repond 404/410 (revoque cote navigateur) est
    automatiquement supprime en base plutot que reessaye indefiniment.
  - `push.controller.ts` / `push.routes.ts` : `GET /push/public-key`
    (cle VAPID publique + etat d'activation), `POST /push/subscribe`,
    `POST /push/unsubscribe`.
- `backend/src/realtime/socket.ts` : ajoute `hasActiveSocket()`. Sert de
  garde-fou pour ne declencher un push que si l'utilisateur n'a vraiment
  aucun socket ouvert — sinon il vient deja de recevoir l'evenement temps
  reel correspondant (`notifyUser`), une notification systeme en plus serait
  redondante.
- `backend/src/modules/voice-messages/voice-messages.controller.ts` :
  declenche un push *"Nouveau message vocal de X"* (exemple donne par la
  section 11) si le destinataire n'a aucun socket actif au moment de
  l'envoi.
- `backend/src/realtime/webrtc.signaling.ts` : declenche un push *"X essaie
  de vous contacter"* (autre exemple de la section 11) quand une offre
  WebRTC part vers un utilisateur hors ligne — l'offre expire de toute facon
  au bout de 20s (`OFFER_TIMEOUT_MS`, Phase 6) sans reponse possible, ce push
  est le seul moyen pour le destinataire de savoir qu'on a cherche a le
  joindre.
- `talkie-app/public/push-sw.js` (Phase 9, **supprime en Phase 10**) :
  service worker dedie aux evenements `push` / `notificationclick`,
  enregistre manuellement (pas via `vite-plugin-pwa`). Volontairement
  separe du service worker de cache prevu Phase 10 (section 15), pour ne
  pas coupler les deux perimetres avant l'heure — sa logique a ete
  deplacee dans `src/sw.ts` en Phase 10, voir plus bas.
- `talkie-app/src/lib/pushApi.ts` (nouveau) : appels au backend (cle
  publique, abonnement, desabonnement), meme pattern que
  `lib/contactsApi.ts`.
- `talkie-app/src/hooks/usePushNotifications.ts` (nouveau) : enregistre le
  service worker, gere l'etat d'abonnement `PushManager`. Respecte
  strictement la section 11 (*"Ne jamais contourner les permissions de
  notification"*) : `Notification.requestPermission()` n'est appele que
  depuis `subscribe()`, a l'initiative explicite de l'utilisateur — jamais
  automatiquement au chargement de l'app.
- `talkie-app/src/pages/Settings.tsx` : nouveau toggle *Notifications push*,
  desactive visuellement (avec message explicatif) si le navigateur ne
  supporte pas l'API Push.

### Limites connues (Phase 9)

- Necessite HTTPS en production (les navigateurs n'autorisent Web Push que
  sur origine securisee, `localhost` excepte en dev — section 3).
- Pas de re-envoi programme si `web-push` echoue pour une raison autre que
  404/410 (ex. coupure reseau temporaire du service de push) : l'echec est
  seulement journalise, sans file d'attente/retry — a revoir avant une mise
  en production a plus grande echelle.
- Le contenu des notifications (titre/corps) est fixe cote serveur ; pas de
  granularite par type d'evenement dans les reglages (ex. desactiver les
  push d'appel mais garder ceux des messages vocaux) — hors perimetre de
  cette phase.

## Correctif : icones PWA (index.html / manifest)

`index.html` et `public/manifest.webmanifest` referencaient uniquement des
icones `.svg`. Deux consequences reelles :

- **iOS/Safari** ignore le SVG pour `apple-touch-icon` : l'icone sur l'ecran
  d'accueil retombe sur une capture d'ecran generique au lieu du logo.
- **Android/Chrome** exclut les icones SVG des criteres d'installabilite du
  manifest (le critere officiel exige un PNG/WebP en 192×192 et 512×512) —
  risque que le bandeau "Ajouter a l'ecran d'accueil" (section 15 du cahier
  des charges) ne s'affiche pas de facon fiable.

Correctif : generation de PNG (`icons/icon-192.png`, `icon-512.png`,
`icon-maskable.png`), d'un `apple-touch-icon.png` opaque en 180×180 (sans
coins arrondis ni alpha — iOS applique son propre masque et rend sinon le
fond transparent en noir), et d'un `favicon.ico` multi-tailles (16/32/48).
`index.html`, `manifest.webmanifest` et `vite.config.ts`
(`includeAssets`/`globPatterns` du plugin PWA) ont ete mis a jour en
consequence. Les `.svg` sources restent dans `public/icons/` a titre de
reference si les icones doivent etre retravaillees plus tard.



- Node.js 18+
- npm 9+
- PostgreSQL 14+ (local, ou un service manage type Supabase/Neon/Railway)

## Installation — backend

```bash
cd backend
npm install
cp .env.example .env
# Modifiez DATABASE_URL dans .env pour pointer vers votre PostgreSQL.
# Exemple pour creer rapidement une base locale :
#   createdb talkie
npm run migrate   # cree la table `users` (et les suivantes, aux phases suivantes)
npm run dev       # demarre l'API sur http://localhost:4000
```

Verifiez que l'API repond : `curl http://localhost:4000/health` doit renvoyer
`{"status":"ok"}`.

Pour activer les notifications push (Phase 9, optionnel) :

```bash
npm run vapid:generate   # affiche une paire de cles VAPID
# Copiez-les dans .env : WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY
```

## Installation — frontend

```bash
cd talkie-app
npm install
cp .env.example .env
# VITE_API_URL doit pointer vers l'API backend (http://localhost:4000 par defaut)
npm run dev
```

L'application est servie sur `http://localhost:5173`. Ouvrez-la sur votre telephone
(meme reseau Wi-Fi) via l'IP locale affichee dans le terminal pour tester le rendu
mobile reel — dans ce cas, `VITE_API_URL` et `CORS_ORIGIN` (cote backend) doivent
utiliser l'IP locale plutot que `localhost`.

## Variables d'environnement

- `talkie-app/.env.example` → `talkie-app/.env` (frontend, notamment `VITE_API_URL`).
- `backend/.env.example` → `backend/.env` (backend : `DATABASE_URL`, `JWT_SECRET`,
  `PORT`, `CORS_ORIGIN`). Generez un `JWT_SECRET` fort en production, par
  exemple avec `openssl rand -hex 32`.
- `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` (backend, Phase 9) :
  optionnelles, generees avec `npm run vapid:generate` (depuis `backend/`).
  Le frontend n'a pas besoin de sa propre cle : il la recupere via
  `GET /push/public-key`.

## Structure du projet

```
(racine du depot)
  backend/
    src/
      db/
        pool.ts              # Pool de connexions PostgreSQL
        migrate.ts            # Lanceur de migrations SQL (npm run migrate)
        migrations/
          001_create_users.sql
          002_create_contacts.sql
          003_create_voice_messages.sql   # Phase 8
      modules/
        voice-messages/         # Upload, stockage disque, lecture streamee — Phase 8
      modules/auth/
        auth.schemas.ts       # Validation des entrees (zod)
        auth.service.ts       # Requetes SQL + logique metier
        auth.controller.ts    # Handlers Express (cookie de session, JSON)
        auth.routes.ts        # POST /auth/register, /login, /logout, GET /auth/me
      modules/contacts/        # Ajout, recherche, blocage (Phase 4)
      realtime/
        socket.ts              # Init Socket.IO + presence en ligne (Phase 5)
        presence.service.ts     # Mise a jour is_online / last_seen en base
        webrtc.signaling.ts     # Relais offer/answer/ICE + anti double-appel (Phase 6)
      middleware/
        requireAuth.ts        # Garde de route (verifie le cookie de session)
        authRateLimit.ts       # Limite basique par IP sur /auth (Phase 11 = version complete)
        errorHandler.ts        # Middleware d'erreurs global
      utils/                   # password (bcrypt), jwt, presentation, AppError
      index.ts                 # Point d'entree du serveur (HTTP + WebSocket)

  talkie-app/
    public/
      manifest.webmanifest   # Manifest PWA
      icons/                 # Icones SVG (192, 512, maskable)
    src/
      components/
        RequireAuth.tsx       # Garde de route (session requise) — Phase 2
        GuestOnly.tsx          # Garde inverse (login/register) — Phase 2
      context/
        AuthContext.tsx        # Session utilisateur (user, status, login/register/logout) — Phase 2
        SettingsContext.tsx    # Preferences appareil (mode verrouillage PTT), localStorage — Phase 7
      lib/
        authApi.ts              # Appels au backend reel (fetch + cookie) — Phase 3
      hooks/
        useWebRTCCall.ts      # Vraie logique WebRTC (getUserMedia, RTCPeerConnection,
                               # signalisation) — remplace la simulation de la Phase 1
      lib/
        socket.ts              # Client Socket.IO partage (presence + signalisation)
        webrtcConfig.ts         # Construction des iceServers (STUN/TURN) depuis .env
      pages/                  # Un fichier par route (voir App.tsx)
      hooks/
        useVoiceRecorder.ts    # Enregistrement MediaRecorder (vocaux hors ligne) — Phase 8
      lib/
        voiceMessagesApi.ts    # Appels au backend (liste, envoi, ecoute) — Phase 8
      hooks/
        usePWAUpdate.ts        # Etat maj/hors-ligne du service worker — Phase 10
        useInstallPrompt.ts    # Capture beforeinstallprompt — Phase 10
      components/
        UpdateToast.tsx        # Bandeau maj/hors-ligne — Phase 10
      sw.ts                    # Service worker unique : cache app shell + push — Phase 10
      types.ts                # Types partages (User, Contact, CallState, ...)
      App.tsx                 # Declaration des routes + gardes d'authentification
```

## Phase 10 : PWA installable (section 15 du cahier des charges)

Objectif : rendre l'app reellement installable depuis Chrome/Android
(`Ajouter a l'ecran d'accueil`), avec un cache des ressources essentielles
et un ecran-coquille disponible meme hors ligne — sans jamais laisser
croire que les appels vocaux temps reel fonctionnent sans reseau.

- `talkie-app/src/sw.ts` (nouveau) : **service worker unique** de l'app,
  remplace `public/push-sw.js` (Phase 9). Un seul service worker peut
  controler la scope `/` a la fois ; en avoir deux enregistres separement
  (le cache genere par `vite-plugin-pwa` d'un cote, `push-sw.js` de
  l'autre) aurait fait que l'un ecrase l'autre au lieu de coexister. `sw.ts`
  fait donc les deux :
  - precache l'app shell (JS/CSS/HTML/icones/polices) via
    `workbox-precaching`, liste injectee automatiquement au build ;
  - sert les navigations en `NetworkFirst` avec repli sur l'app shell
    precache (jamais d'ecran blanc, meme hors ligne) ;
  - gere les evenements `push` / `notificationclick`, logique reprise a
    l'identique de `push-sw.js`.
  Les appels API/WebSocket (`VITE_API_URL` / `VITE_WS_URL`, autre origine)
  ne passent jamais par ce cache.
- `talkie-app/vite.config.ts` : `VitePWA` bascule de la strategie
  `generateSW` (deja presente en Phase 9 en preparation, mais jamais
  activee cote client) a `injectManifest`, pour pouvoir ecrire `sw.ts` a la
  main. `registerType: 'prompt'` plutot que `'autoUpdate'` : recharger
  l'app automatiquement en pleine communication WebRTC couperait l'appel
  en cours — c'est desormais l'utilisateur qui choisit le moment.
- `talkie-app/src/hooks/usePWAUpdate.ts` (nouveau) : encapsule
  `virtual:pwa-register/react` (fourni par `vite-plugin-pwa`), qui
  declenche l'enregistrement du service worker et expose l'etat
  "mise a jour disponible" / "pret hors ligne". Verifie aussi une mise a
  jour toutes les heures (l'app peut rester ouverte longtemps en
  arriere-plan sur mobile).
- `talkie-app/src/components/UpdateToast.tsx` (nouveau) : bandeau discret
  affiche quand une mise a jour est disponible ou que le mode hors ligne
  est pret, monte dans `App.tsx` hors des routes pour rester visible sur
  n'importe quel ecran.
- `talkie-app/src/hooks/useInstallPrompt.ts` (nouveau) : capture
  l'evenement natif `beforeinstallprompt` (`event.preventDefault()` pour
  desactiver la mini-infobar automatique de Chrome) et expose `canInstall`
  / `installed` / `promptInstall()`. Detecte aussi le mode deja installe
  via `display-mode: standalone`.
- `talkie-app/src/pages/Settings.tsx` : nouvelle section *Application* avec
  un bouton *Installer* (visible seulement si `beforeinstallprompt` a ete
  capture) ou une confirmation *"Talkie est installe sur cet appareil"*.
  L'installation reste egalement disponible via l'icone native de la barre
  d'adresse Chrome, independamment de ce bouton.
- `talkie-app/src/hooks/usePushNotifications.ts` : n'enregistre plus son
  propre service worker (`register('/push-sw.js')`) ; attend desormais que
  le service worker unique de l'app devienne actif
  (`navigator.serviceWorker.ready`), quel que soit le composant qui a
  declenche son enregistrement — pas de course possible entre les deux
  hooks.
- `talkie-app/tsconfig.sw.json` (nouveau) : projet TypeScript separe pour
  `sw.ts` (`lib: ["WebWorker"]` au lieu de `DOM`, types globaux
  incompatibles avec le reste de l'app) ; exclu du projet principal
  (`tsconfig.json`) mais reference pour que `tsc -b` le type-check quand
  meme.
- `talkie-app/public/manifest.webmanifest`, `public/icons/*` : deja
  presents depuis la preparation Phase 9, inchanges (nom, `display:
  standalone`, couleurs, icone `maskable` incluse). Chrome genere l'ecran
  de demarrage (*splash screen*) automatiquement a partir de ces
  informations, aucun fichier dedie a fournir.

### Limites connues (Phase 10)

- Le mode hors ligne couvre uniquement l'**app shell** (interface,
  navigation, ecran statique) — pas les donnees. Sans reseau, l'app
  s'ouvre mais contacts, messages vocaux et appels restent indisponibles
  (erreurs deja gerees par les ecrans existants). Conforme a la section 15
  ("cache des ressources essentielles"), pas a un mode hors-ligne complet
  non demande par le cahier des charges.
- `beforeinstallprompt` ne se declenche que sur Chrome/Android (perimetre
  cible, section 1 et 16) ; sur les navigateurs qui ne l'emettent pas, le
  bouton *Installer* reste masque mais l'installation manuelle depuis le
  menu du navigateur fonctionne toujours.
- Aucune queue d'envoi differe pour les messages vocaux enregistres hors
  ligne (distinct de la Phase 8, qui gere le destinataire hors ligne, pas
  l'emetteur) : non demande par le cahier des charges pour cette phase.

## Identite visuelle

- **Couleurs** : `ink` #12161C (chassis), `panel` #1B212A, `signal` #3FAFA6 (en ligne),
  `transmit` #F0A233 (transmission — couleur de la LED d'un poste radio), `alert` #E1594F
  (hors ligne / erreur), `paper` #EDEFF2 (texte).
- **Typographies** : Space Grotesk (titres), Inter (texte courant), JetBrains Mono
  (identifiants/callsigns, horodatages) — evoque les indicatifs et frequences radio.
- **Element signature** : le bouton Push-to-Talk, cadran circulaire avec anneau
  VU-metre qui reagit au niveau vocal pendant la transmission.

## Roadmap (phases 2 a 12)

| Phase | Contenu |
|---|---|
| 2 | Inscription / connexion reelles (API) |
| 3 | PostgreSQL + modele `users` |
| 4 | Contacts (ajout, recherche, blocage) cote serveur |
| 5 | WebSocket + presence en ligne |
| 6 | ✅ WebRTC audio (offer/answer, ICE, STUN/TURN) |
| 7 | ✅ Verrouillage Push-to-Talk |
| 8 | ✅ Messages vocaux hors ligne (upload + stockage) |
| 9 | ✅ Notifications Web Push |
| 10 | ✅ Installation PWA complete (service worker de cache) |
| 11 | ✅ Securite (rate limiting, CSRF, suppression de compte) et tests automatises |
| 12 | Deploiement |

## Limites connues (Phase 7)

- Le mode verrouillage est un reglage **par appareil** (localStorage), pas
  un reglage de compte : il ne se synchronise pas si l'utilisateur se
  connecte depuis un autre telephone. A revoir si ce comportement doit
  devenir une preference serveur.
- La reduction de bruit (`noiseReduction` dans Settings) reste un toggle
  d'interface non encore branche sur les contraintes `getUserMedia` — sans
  effet reel pour l'instant (hors perimetre de cette phase).
- Pas de reglage equivalent pour la sensibilite du VU-metre ou un seuil de
  silence automatique (non demande par le cahier des charges).

## Limites connues (Phase 6)

- **Les deux utilisateurs doivent avoir l'ecran `/talk/<contact>` ouvert
  l'un vers l'autre** pour que la connexion s'etablisse : il n'y a pas
  encore de "sonnerie" globale qui reveillerait un correspondant occupe
  ailleurs dans l'app. C'est le prochain axe d'amelioration naturel, mais
  hors perimetre de cette phase (qui se concentre sur l'audio lui-meme).
- Sans serveur TURN configure (`VITE_TURN_URL` vide), la connexion
  fonctionnera en local/meme reseau mais **echouera souvent** entre deux
  reseaux avec NAT symetrique (typique en 4G/box grand public) — un STUN
  seul ne suffit pas toujours pour "Dakar -> Paris" en conditions reelles
  (section 1). Un TURN est necessaire pour un usage fiable en production.
  `talkie-app/.env.example` documente les variables correspondantes.
- Un seul appel 1:1 a la fois par utilisateur ; les groupes (section 12) ne
  sont pas encore geres par la signalisation.
- Le VU-metre ne reflete que le niveau du micro local, pas celui du flux recu.
- Pas encore de table `devices` (Phase 9 : necessaire pour les notifications
  Web Push) — `voice_messages` existe depuis la Phase 8, voir plus haut.
- Pas de confirmation d'e-mail ni de recuperation de mot de passe.
- Les icones PWA sont des SVG simples ; a remplacer par une identite finale si besoin.

## Phase 11 — Securite et tests

### Ajouts securite (section 13 du cahier des charges)

- **En-tetes HTTP** : `helmet` sur toute l'API (backend/src/middleware/security.ts).
  La CSP est desactivee volontairement (API JSON pure, aucun HTML servi) ;
  `Cross-Origin-Resource-Policy` est assoupli a `cross-origin` pour que le
  frontend (origine separee) puisse lire les messages vocaux via `<audio>`.
- **Rate limiting generalise** : une limite large sur toute l'API
  (`apiRateLimit`, 300 req/min/IP), et des limites plus strictes sur les
  endpoints les plus couteux : `/auth/login` et `/auth/register` (deja en
  place depuis la Phase 3, `authRateLimit.ts`), `/contacts/search` (30/min)
  et `POST /voice-messages` (20/min).
- **Protection CSRF** (`backend/src/middleware/csrfProtection.ts`) : toute
  requete qui modifie un etat (POST/PUT/PATCH/DELETE) doit porter l'en-tete
  `X-Requested-With`. Une simple balise `<form>` sur un site tiers ne peut
  pas ajouter cet en-tete — ni forcer le `Content-Type: application/json`
  des routes JSON, ni contourner `SameSite=Lax` sur le cookie de session.
  Cible en particulier `POST /voice-messages`, seule route en
  `multipart/form-data` (un type de contenu qu'une `<form>` classique peut
  emettre cross-site).
- **`trust proxy`** active en production : necessaire derriere un reverse
  proxy pour que `req.ip` (utilise par les limiteurs ci-dessus) refere la
  vraie IP du client plutot que celle du proxy.
- **Suppression de compte** (`DELETE /auth/me`) : supprime les fichiers
  audio de l'utilisateur sur disque puis le compte en base — contacts,
  messages vocaux et abonnements push associes sont effaces via les
  contraintes `ON DELETE CASCADE` des migrations. Accessible depuis
  Profil > *Supprimer mon compte* (double confirmation dans l'interface).

### Tests automatises

- **Backend** (`backend/`, Vitest + Supertest) : `npm test`.
  - Tests unitaires sur la logique metier (`auth.service`,
    `contacts.service`, `voice-messages.service`) avec le pool PostgreSQL
    mocke — verifient les regles (identifiant deja pris, anti-enumeration
    a la connexion, contact bloque, fichier non-audio refuse, acces refuse
    a un tiers sur un vocal...), pas le SQL lui-meme.
  - Tests unitaires sur les utilitaires de securite (`password.ts`,
    `jwt.ts`) et les middlewares (`requireAuth`, `csrfProtection`).
  - Un test d'integration HTTP (`auth.routes.test.ts`, Supertest) verifie
    le cablage reel : rejet CSRF, validation Zod, cookie de session pose,
    codes de statut.
  - **Hors perimetre de ces tests** (necessitent une vraie base
    PostgreSQL) : les requetes SQL elles-memes, les migrations, et tout
    parcours de bout en bout via une vraie base. A couvrir par des tests
    d'integration diriges vers une base de test si le projet grandit
    (`DATABASE_URL` pointant vers une instance PostgreSQL jetable).
- **Frontend** (`talkie-app/`, Vitest + Testing Library) : `npm test`.
  - Validation d'identifiant/mot de passe (`authApi.test.ts`).
  - Composant `PTTButton` : libelles par etat, etat desactive, comportement
    maintenir/relacher, garde anti-double-declenchement, mode verrouillage.

### Ce que les tests automatises ne couvrent pas

Les elements suivants (section 20 du cahier des charges) demandent un
navigateur reel, un microphone, deux appareils ou une manipulation reseau —
ils restent du ressort d'une verification manuelle. Voir
`talkie-app/MANUAL_TESTING.md` pour la checklist correspondante :
permissions microphone, etablissement reel d'une session WebRTC entre deux
appareils, coupure/reconnexion reseau, installation PWA depuis Chrome, et
verification responsive (petit Android, smartphone moyen, tablette, desktop).

## Phase 12 — Deploiement

Guide complet : `DEPLOYMENT.md` a la racine du depot (pas dans ce dossier,
car il couvre aussi `backend/`). Resume :

- **Frontend** : `vercel.json` / `netlify.toml` (deja presents depuis la
  Phase 10) suffisent tels quels — deployer `talkie-app/` comme racine du
  projet sur Vercel ou Netlify, avec les variables `VITE_*` de production
  (notamment `VITE_TURN_URL` — voir plus bas).
- **Backend** : `backend/Dockerfile` (nouveau, multi-stage, utilisateur
  non-root, `HEALTHCHECK` sur `/health`) — deployable tel quel sur
  Railway/Render/Fly.io. Necessite un volume persistant sur `/app/uploads`
  (les messages vocaux, section 4, sont stockes sur disque — Phase 8).
- **PostgreSQL** : n'importe quel service managed compatible
  `postgresql://` (Railway, Render, Neon, Supabase...) ; migrations via
  `npm run migrate` (deja existant depuis la Phase 3).
- **TURN** : `docker-compose.yml` (racine du depot, nouveau) installe
  `coturn` pour l'auto-hebergement. Section critique du cahier des charges
  (1, "Dakar -> Japon") : le STUN public seul ne suffit pas des qu'un des
  deux utilisateurs est derriere un NAT symetrique/CGNAT (frequent en
  4G) — sans TURN en production, une partie des appels echoueront
  silencieusement. Voir `DEPLOYMENT.md` section 4 pour l'auto-hebergement
  ou les alternatives en service gere.
- **CI** : `.github/workflows/ci.yml` (nouveau) fait tourner les suites de
  tests existantes (Phase 11, backend + frontend) a chaque push/PR, avec un
  vrai service PostgreSQL ephemere pour le backend. N'ajoute aucun nouveau
  test.
- **Limites connues** documentees dans `DEPLOYMENT.md` (section 9) :
  stockage des vocaux sur disque local (pas de scaling horizontal sans
  migrer vers un stockage objet), presence/appariement d'appel en memoire
  du process backend (une seule instance a la fois sans store partage type
  Redis), identifiants TURN statiques dans le bundle frontend.

C'est la derniere phase prevue par le cahier des charges (section 22). Les
evolutions au-dela (groupes au-dela de 10 utilisateurs — section 12 —,
scaling horizontal du backend, stockage objet pour les vocaux, TURN a
identifiants temporaires) restent hors perimetre MVP et sont listees comme
limites connues plutot qu'implementees, conformement a la section 3
("privilegie la solution... peu couteuse pour un MVP").
