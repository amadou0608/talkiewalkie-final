# --- Etape 1 : build -------------------------------------------------------
# Compile le TypeScript avec les devDependencies, jamais presentes dans
# l'image finale (section 3 du cahier des charges : infra "peu couteuse" —
# on ne paie pas le poids de tsc/vitest/types en production).
FROM node:20-alpine AS build
WORKDIR /app

# npm ci exige un package-lock.json commite (voir DEPLOYMENT.md, checklist :
# `npm install` a lancer une fois en local puis committer le lockfile) et
# installe exactement les versions qu'il fixe — build reproductible.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etape 2 : production ---------------------------------------------------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Utilisateur non-root (section 13 : durcissement securite). L'image node
# alpine fournit deja "node" (uid 1000) — inutile de recreer un utilisateur.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Dossier de stockage des messages vocaux (section 4 : voice_messages,
# storage.ts) : doit correspondre au point de montage du volume persistant
# en production (voir DEPLOYMENT.md — sans volume, les vocaux sont perdus a
# chaque redeploiement/redemarrage du conteneur).
RUN mkdir -p /app/uploads/voice-messages && chown -R node:node /app
VOLUME ["/app/uploads"]

USER node

EXPOSE 4000

# Sonde de sante utilisee par la plupart des plateformes (Railway, Render,
# Fly, un reverse proxy Docker...) pour savoir si le conteneur est pret a
# recevoir du trafic. Reutilise la route /health deja exposee par
# src/index.ts (aucun changement cote code applicatif necessaire).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
