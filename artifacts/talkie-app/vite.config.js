var _a;
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
var rawPort = process.env.PORT;
if (!rawPort) {
    throw new Error('PORT environment variable is required but was not provided.');
}
var port = Number(rawPort);
if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid PORT value: \"".concat(rawPort, "\""));
}
var basePath = (_a = process.env.BASE_PATH) !== null && _a !== void 0 ? _a : '/';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            // Phase 10 (section 15) : strategie injectManifest plutot que
            // generateSW. On ecrit le service worker a la main (src/sw.ts) pour
            // qu'il gere a la fois le cache/hors-ligne ET les notifications push
            // (anciennement public/push-sw.js) dans UN SEUL fichier — deux
            // service workers enregistres separement sur la meme scope ('/')
            // s'ecraseraient l'un l'autre. vite-plugin-pwa se charge seulement
            // d'y injecter la liste des fichiers a precacher.
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            // 'prompt' et non 'autoUpdate' : un rechargement silencieux en
            // pleine communication vocale WebRTC couperait l'appel en cours.
            // L'utilisateur choisit le moment via le bandeau UpdateToast.
            registerType: 'prompt',
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
            },
            includeAssets: [
                'favicon.ico',
                'apple-touch-icon.png',
                'icons/icon-192.png',
                'icons/icon-512.png',
                'icons/icon-maskable.png',
            ],
            manifest: false, // on fournit public/manifest.webmanifest nous-memes
            devOptions: {
                enabled: false, // SW actif uniquement en build de production
            },
        }),
    ],
    resolve: {
        alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
        host: '0.0.0.0',
        port: port,
        strictPort: true,
        allowedHosts: true,
    },
    preview: {
        host: '0.0.0.0',
        port: port,
        strictPort: true,
        allowedHosts: true,
    },
    base: basePath,
    root: path.resolve(import.meta.dirname),
    build: {
        outDir: path.resolve(import.meta.dirname, 'dist/public'),
        emptyOutDir: true,
    },
});
