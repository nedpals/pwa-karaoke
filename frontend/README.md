# PWA Karaoke Frontend

The React app for PWA Karaoke. It serves both screens: the **display** that plays videos on a TV or laptop, and the **controller** that runs on phones. It is built with React 19, TypeScript, Vite, Tailwind CSS 4 and React Router, and it installs as a PWA through `vite-plugin-pwa`.

For first-time setup of the whole project, see [Local development](../README.md#local-development) in the root README. For the contribution workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Getting started

Requires Node.js 20 or newer, and the backend running on `http://localhost:8000`.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173` on your laptop. To use a phone as a controller, open the **Network** address Vite prints (for example `http://192.168.1.5:5173`) while the phone is on the same network.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server on port 5173, reachable from your local network |
| `npm run build` | Type checks and builds into `dist/` |
| `npm run build:prod` | Type checks and builds into `../backend/static`, where the backend serves it on port 8000 |
| `npm run preview` | Serves the last build from `dist/` |
| `npm run lint` | Runs ESLint. CI fails on errors, warnings are fine |
| `npm run storybook` | Starts Storybook on port 6006 |
| `npm run build-storybook` | Builds a static Storybook |

CI runs `npm run lint` and `npm run build` on every pull request.

## Talking to the backend

The app always calls the backend on its own origin: HTTP requests go to `/search`, `/get_video_url`, `/rooms` and so on, and the WebSocket connects to `/ws`. In development, the Vite dev server and `npm run preview` proxy those paths to the backend. In production the backend serves the built app itself, so no proxy is needed.

The proxy targets `http://localhost:8000` by default. To use a backend somewhere else, set `VITE_BACKEND_URL`, either in your shell or in `frontend/.env.local`:

```bash
VITE_BACKEND_URL=http://192.168.1.20:8000
```

Search and video URL requests are authenticated with the room id and password, so they only work after joining a room. The WebSocket protocol is documented in [backend/README.md](../backend/README.md#websocket-protocol).

## Project structure

```
src/
├── main.tsx           Entry point, registers the service worker
├── routes.tsx         Routes: / (home), /player (display), /controller and /remote (controller)
├── pages/             One component per route
├── components/
│   ├── atoms/         Small building blocks: Button, Input, Text, Panel
│   ├── molecules/     Combinations of atoms: SearchInput, IconButton, TimeDisplay
│   ├── organisms/     Larger pieces: QueueItem, SongRow, NowPlayingBanner, ScoreScreen
│   ├── templates/     Page layouts: ControllerLayout, FullScreenLayout
│   └── icons/         Icon components
├── providers/         RoomProvider, which shares room state with every component
├── hooks/             Room, WebSocket, sync and scoring logic
├── api/client.ts      HTTP client for the backend
├── lib/               Helpers: local storage, scoring math, reactions, utilities
└── types.ts           Types shared with the backend protocol
```

The hooks that matter most:

- `useWebSocket` opens the `/ws` connection, performs the handshake and sends commands, with optional acknowledgements.
- `useRoom` builds on it: it joins the room, keeps the queue, player state and settings, and exposes actions such as `queueSong`.
- `useSmartSync` keeps follower displays in time with the leader display.
- `useLoudnessScore` scores singing from the phone microphone.
- `useApi` wraps search and video URL lookups with SWR.

`pages/PlayerPage.tsx` and `pages/ControllerPage.tsx` are large. Changes are usually easier to make and review in a component.

## Storybook

Most components in `src/components/` have a `*.stories.tsx` file next to them, so you can build and check a component without the backend running:

```bash
npm run storybook
```

Shared sample data for stories lives in `src/components/fixtures.ts`. When you add or change a component, add or update its story.

## Notes

- **Microphone scoring needs HTTPS.** Browsers only allow the microphone on secure origins, so a phone on `http://<LAN-IP>:5173` falls back to generated scores. This is expected in development.
- **Service worker.** The production build registers a service worker that updates itself on each deploy. It is not active under `npm run dev`. If an old build sticks around after testing `npm run preview` or `build:prod`, unregister the service worker in your browser's developer tools.
