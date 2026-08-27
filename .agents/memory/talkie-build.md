---
name: Talkie frontend build
description: Non-obvious requirements for validating the Talkie Vite/PWA frontend.
---

The Talkie frontend production build requires a `PORT` environment variable, and
the PWA virtual registration requires `workbox-window` to be a direct frontend
dependency.

**Why:** The Replit Vite configuration intentionally fails fast without `PORT`,
and vite-plugin-pwa does not bundle `workbox-window` automatically.

**How to apply:** Set `PORT` when running a standalone production build and keep
the Workbox window package installed alongside the PWA dependencies.