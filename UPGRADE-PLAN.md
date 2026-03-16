# Visor — Upgrade Plan

Plan integral de desarrollo para llevar Visor de prototipo funcional (v0.1.0) a herramienta de produccion robusta (v1.0.0).

Organizado en **fases secuenciales**, cada una con tareas concretas que pueden asignarse a agentes especializados que trabajan en paralelo.

---

## Estado de completitud

> **Fases 1-4 COMPLETADAS** (2026-03-16). Fase 5 (polish/extras) queda pendiente como mejoras futuras post-v1.0.

---

## Estado actual

```
fcc3f4d  Phase 4: CI/CD, Docker, rate limiting, CORS config, WS validation, PWA offline
302d702  Phase 3: Events API, session rename/search, Ollama chat UI, output replay
6584cbc  Phase 2: Unify shared types, clean dependencies, fix cross-platform scripts
a404d18  Phase 1: Add error boundaries, input validation, security headers, and 51 tests
8b7dee8  Add comprehensive upgrade plan (UPGRADE-PLAN.md)
d4be89c  Improve security, UX, and code quality across the codebase
f837802  Add WebSocket auth, server-side chat mode, Ollama router, and cleanup dead code
063447d  Add mobile chat view, MobileToolbar integration, and PWA support
544e8a2  Add session persistence and auto-restore on restart
63c8884  Initial release: remote agent session manager
```

- 10 commits, 3 workspaces: server, web, shared (+ cli)
- Tests, CI/CD, Docker, security hardening — todo implementado
- Listo para uso en produccion

---

## Fase 1 — Estabilidad y fiabilidad ✅ COMPLETADA

**Objetivo**: Que la aplicacion no se rompa en uso normal. Error boundaries, validacion, y tests criticos.

### Equipo A: Frontend Resilience

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| A1. Error boundary global | `web/src/App.tsx`, nuevo `web/src/components/ErrorBoundary.tsx` | Crear componente ErrorBoundary class que atrape errores de React y muestre una pantalla de "algo salio mal" con boton de reload. Envolver `<Dashboard>` y `<SessionView>` individualmente. |
| A2. Error boundary en ChatView | `web/src/components/ChatView.tsx` | El markdown rendering de `react-markdown` puede fallar con contenido malformado. Envolver `<MarkdownMessage>` en un boundary que muestre el texto raw si falla. |
| A3. Loading/error states en controles | `web/src/components/SessionView.tsx` | `handleControl` y `handleDelete` no muestran loading ni errores al usuario. Anadir estados `controlLoading`, `controlError` y mostrarlos en la UI. Los errores que ahora van a `console.error` deben mostrarse como toast o inline. |
| A4. JSON.parse protegido en WebSocket | `web/src/hooks/useWebSocket.ts:42` | Envolver `JSON.parse(event.data)` en try/catch. Un mensaje malformado no debe crashear la app. |
| A5. Estabilizar React keys en ChatView | `web/src/components/ChatView.tsx:211` | Reemplazar `key={i}` por un ID estable (contador incremental o `ts + index`). |

### Equipo B: Server Validation

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| B1. Validacion de input en API routes | `server/src/api/routes.ts` | Todos los endpoints usan `c.req.json<T>()` que castea sin validar. Anadir validacion manual (o con zod) en los POSTs: `POST /sessions` (name, type, command requeridos), `POST /sessions/:id/input` (data requerido), `POST /sessions/:id/resize` (cols, rows numericos). Devolver 400 con mensaje claro si falla. |
| B2. Cachear config en health endpoint | `server/src/api/routes.ts:63` | `loadConfig()` se llama en cada GET /api/health. Inyectar el config una vez al crear las rutas (parametro o closure) en vez de recalcular. |
| B3. Enmascarar token en logs | `server/src/index.ts` | El Hono logger muestra la URL completa incluyendo `?token=...`. Crear un middleware custom que reemplace el token en la URL logueada por `?token=***`. |
| B4. Security headers | `server/src/index.ts` | Anadir middleware con headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. |

### Equipo C: Tests basicos

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| C1. Setup test runner | `server/package.json`, nuevo `server/vitest.config.ts` | Instalar vitest. Configurar para que ejecute tests en `server/src/**/*.test.ts`. Anadir script `test` en server y root package.json. |
| C2. Tests de ScreenBuffer | Nuevo `server/src/core/screen-buffer.test.ts` | Tests unitarios: write texto simple, write ANSI codes, extractNewContent deduplicacion, resize, chrome filtering. Al menos 8-10 tests. |
| C3. Tests de auth middleware | Nuevo `server/src/api/auth.test.ts` | Tests: token valido pasa, token invalido devuelve 401, sin token devuelve 401, token en query param. |
| C4. Tests de pty-parser | Nuevo `web/src/lib/pty-parser.test.ts`, `web/vitest.config.ts` | Setup vitest para web. Tests del OutputAccumulator: push texto limpio, strip ANSI, deduplicacion, flush, clear. |
| C5. Tests de database | Nuevo `server/src/db/database.test.ts` | Tests: insert/get/update/delete session, insertEvent, pruneEvents, getEvents (aunque sin ruta, la funcion existe). Usar DB in-memory. |

**Commit**: `a404d18 Phase 1: Add error boundaries, input validation, security headers, and 51 tests`

---

## Fase 2 — Limpieza y arquitectura ✅ COMPLETADA

**Objetivo**: Eliminar deuda tecnica, unificar tipos, limpiar dependencias.

### Equipo D: Shared Types Package

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| D1. Crear workspace shared | Nuevo `shared/package.json`, `shared/src/types.ts` | Crear paquete `@visor/shared` con las definiciones de tipos compartidos: Session, SessionType, SessionStatus, EventKind, SessionEvent, WsServerMessage, WsClientMessage, SubscribeMode, CreateSessionOpts. |
| D2. Migrar server a shared types | `server/src/core/types.ts`, `server/package.json` | Reexportar desde `@visor/shared`. Mantener `VisorConfig` local al server (no compartido). Actualizar todos los imports en server/. |
| D3. Migrar web a shared types | `web/src/lib/types.ts`, `web/package.json` | Reexportar desde `@visor/shared`. Eliminar `web/src/lib/types.ts`. Actualizar todos los imports en web/. |

### Equipo E: Dependency & Config Cleanup

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| E1. Mover devDeps correctamente | `web/package.json` | Mover `autoprefixer`, `postcss`, `tailwindcss` de `dependencies` a `devDependencies`. |
| E2. Eliminar deps no usadas | `server/package.json`, `cli/package.json` | Eliminar `strip-ansi` de ambos (nunca importado). |
| E3. Eliminar dead code restante | Varios | Eliminar: `getPtyPid` export en pty-manager.ts, `fetchSession()` y `sendInput()` (HTTP) en api.ts, `WsClientMessage` en types o usarla para validacion (Equipo B), `SessionEvent` interface en web types si no se usa. |
| E4. Unificar .env parsing | Nuevo `shared/src/env.ts` o usar dotenv | El parsing regex de `.env` esta duplicado en `start-with-env.js` y `cli/src/index.ts`. Extraer a utilidad compartida o instalar `dotenv`. |
| E5. Anadir engines field | `package.json` (root) | `"engines": { "node": ">=22.0.0" }` para documentar el requisito de Node 22+. |
| E6. Fix package naming | `web/package.json` | Renombrar `"name": "web"` a `"name": "@visor/web"` para consistencia con server y cli. |
| E7. Fix dev script cross-platform | Root `package.json` | El script `dev` usa `&` (bash background). Usar `concurrently` o `npm-run-all` para que funcione en Windows CMD tambien. |

**Commit**: `6584cbc Phase 2: Unify shared types, clean dependencies, fix cross-platform scripts`

---

## Fase 3 — Features completas ✅ COMPLETADA

**Objetivo**: Completar las features a medio construir y anadir las mas demandadas.

### Equipo F: Events API & Session History

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| F1. Crear ruta GET /api/sessions/:id/events | `server/src/api/routes.ts` | Endpoint con query params `?limit=200&after=0`. Usa `getEvents()` y `getEventCount()` que ya existen en database.ts. Devuelve `{ events, total }`. |
| F2. Crear funcion fetchEvents en api.ts | `web/src/lib/api.ts` | `fetchEvents(id, { limit?, after? })` que llama al endpoint nuevo. |
| F3. Output replay on reconnect | `web/src/hooks/useWebSocket.ts`, `web/src/components/SessionView.tsx` | Al subscribirse a una sesion, cargar los ultimos N eventos desde la API y alimentarlos al terminal (xterm.write para raw) o al ChatView (appendar a lines). Esto soluciona el problema de "terminal vacio al reconectar". |

### Equipo G: Session Management UX

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| G1. Endpoint PATCH /sessions/:id | `server/src/api/routes.ts` | Para renombrar sesiones. Acepta `{ name: string }`. Usa `updateSession()` que ya soporta `name`. |
| G2. UI de rename en SessionView | `web/src/components/SessionView.tsx` | Double-click o boton de edit en el nombre de la sesion. Input inline, Enter para confirmar, Esc para cancelar. Llama al PATCH endpoint. |
| G3. Search/filter en Dashboard | `web/src/components/Dashboard.tsx` | Anadir input de busqueda en el header. Filtra sesiones por nombre, tipo, o estado. Persistir filtro en state (no URL por ahora). |
| G4. Mejorar SessionCard con time update | `web/src/components/SessionCard.tsx` | El "2m ago" no se actualiza. Anadir `useEffect` con `setInterval` de 30s que fuerza re-render. |

### Equipo H: Ollama Integration UI

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| H1. API client para Ollama | `web/src/lib/api.ts` | Funciones: `fetchOllamaModels()`, `ollamaChat(model, messages, onChunk)` con streaming via ReadableStream. |
| H2. Anadir "Ollama" al CreateSessionModal | `web/src/components/CreateSessionModal.tsx` | Nuevo tipo de agente. En vez de spawnar PTY, usa chat directo via API. Mostrar selector de modelo (cargado de /api/ollama/models). |
| H3. OllamaChatView component | Nuevo `web/src/components/OllamaChatView.tsx` | Similar a ChatView pero conecta directamente al API de Ollama, no a un PTY. Input de usuario -> POST /api/ollama/chat -> stream response -> render como markdown bubbles. Reusar MarkdownMessage. |
| H4. Integrar en SessionView | `web/src/components/SessionView.tsx` | Si la sesion es type "ollama", mostrar OllamaChatView en vez de Terminal/ChatView. Sin toggle terminal (no hay PTY). |

**Commit**: `302d702 Phase 3: Events API, session rename/search, Ollama chat UI, output replay`

---

## Fase 4 — Produccion ✅ COMPLETADA

**Objetivo**: Preparar para despliegue real. CI/CD, containerizacion, hardening.

### Equipo I: CI/CD & Tooling

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| I1. GitHub Actions workflow | Nuevo `.github/workflows/ci.yml` | On push/PR: install, build web, run tests (server + web), lint web. |
| I2. Pre-commit hooks | Root `package.json`, nuevo `.husky/` | Instalar husky + lint-staged. En pre-commit: lint los archivos staged (solo web por ahora). |
| I3. Dockerfile | Nuevo `Dockerfile` | Multi-stage build: stage 1 build web, stage 2 setup server con node-pty (necesita build tools). Exponer puerto 3100. |
| I4. Docker Compose | Nuevo `docker-compose.yml` | Servicio visor con volumen para data/visor.db y variables de entorno. |

### Equipo J: Security Hardening

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| J1. Rate limiting | `server/src/index.ts` | Middleware de rate limit: 100 req/min por IP en API, 10 req/min en login attempts. Usar un simple Map con TTL o hono-rate-limit. |
| J2. CORS configurable | `server/src/index.ts`, `server/src/core/config.ts` | Nuevo env var `VISOR_CORS_ORIGIN` (default `*`). Si se especifica, solo permitir ese origin. |
| J3. Content-Security-Policy completo | `server/src/index.ts` | CSP header que permite: self scripts/styles, Google Fonts, inline styles (Tailwind), data: para SVG icons. |
| J4. WsClientMessage validation | `server/src/ws/handler.ts` | Usar el tipo `WsClientMessage` (que ahora es dead code) para validar mensajes entrantes en vez de `any`. Rechazar mensajes malformados. |

### Equipo K: PWA & Offline

| Tarea | Archivo(s) | Detalle |
|---|---|---|
| K1. Cache de Google Fonts en SW | `web/public/sw.js` | Interceptar requests a `fonts.googleapis.com` y `fonts.gstatic.com`, cachear con estrategia cache-first. |
| K2. Generar iconos PNG para PWA | `web/public/` | Usar sharp o un script para generar `icon-192.png` y `icon-512.png` desde el SVG. Actualizar manifest.json para incluir PNG junto a SVG. |
| K3. Offline fallback page | `web/public/offline.html`, `web/public/sw.js` | Cuando el servidor no esta disponible y no hay cache, mostrar una pagina dedicada "Server offline — check your connection" en vez de un error 503. |

**Commit**: `fcc3f4d Phase 4: CI/CD, Docker, rate limiting, CORS config, WS validation, PWA offline`

---

## Fase 5 — Polish & extras (post-v1.0)

Tareas opcionales para versiones futuras. No bloquean el release.

| Tarea | Detalle |
|---|---|
| Background push notifications | Implementar Web Push API con VAPID keys. Requiere HTTPS. Server envia push cuando detecta question. |
| Multi-device resize negotiation | Trackear dimensiones por cliente. PTY usa la interseccion (min cols, min rows). Notificar a otros clientes. |
| Session output size limits | Limitar `data` column en events (truncar a 64KB por evento). |
| DB migrations system | Tabla `migrations` con version. Funciones de migracion para cambios de schema futuros. |
| Session tags/labels | Anadir campo `tags` a sessions. Filtrar por tag en dashboard. |
| Keyboard shortcuts | `Ctrl+K` o `/` para search. `Esc` para volver al dashboard. `Ctrl+Shift+N` para nueva sesion. |
| HTTPS nativo | Opcion de certificado TLS en config. `VISOR_TLS_CERT`, `VISOR_TLS_KEY` env vars. |
| DB encryption at rest | Cifrar el archivo visor.db con una clave derivada del token. |
| CLI build step | Compilar CLI a JS para que funcione con `npx`/`npm link` sin `--experimental-strip-types`. |

---

## Orden de ejecucion y dependencias

```
Fase 1 (Estabilidad)
├── Equipo A (Frontend) ──── puede empezar inmediatamente
├── Equipo B (Server) ────── puede empezar inmediatamente
└── Equipo C (Tests) ─────── puede empezar inmediatamente
    │
    ▼
Fase 2 (Arquitectura)
├── Equipo D (Shared Types) ── depende de que Fase 1 este commiteada
└── Equipo E (Cleanup) ─────── puede empezar con D en paralelo
    │
    ▼
Fase 3 (Features)
├── Equipo F (Events API) ──── depende de Fase 2 (shared types)
├── Equipo G (Session UX) ──── depende de Fase 2
└── Equipo H (Ollama UI) ───── depende de Fase 2
    │
    ▼
Fase 4 (Produccion)
├── Equipo I (CI/CD) ──────── depende de que haya tests (Fase 1)
├── Equipo J (Security) ────── puede empezar con Fase 3 en paralelo
└── Equipo K (PWA) ─────────── puede empezar con Fase 3 en paralelo
```

Dentro de cada fase, los equipos son **independientes** y pueden trabajar en paralelo.

---

## Metricas de completitud

| Fase | Criterio de "hecho" |
|---|---|
| Fase 1 | App no white-screena en ningun error. API valida inputs. Al menos 20 tests pasan. Build limpio. |
| Fase 2 | Un solo paquete de tipos compartido. Zero dead dependencies. Zero dead exports. Scripts cross-platform. |
| Fase 3 | Terminal no vacio al reconectar. Sessions renombrables. Dashboard buscable. Ollama funcional desde UI. |
| Fase 4 | CI verde en push. Docker image buildeable. Rate limiting activo. CSP headers presentes. |

---

*Documento generado: 2026-03-16*
*Ultimo commit: d4be89c*
