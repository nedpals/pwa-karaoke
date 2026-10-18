# PWA Karaoke

A web-based karaoke application that transforms any device into a karaoke system.

> [!IMPORTANT]
> This software is intended for personal, non-commercial use only. Users are responsible for ensuring compliance with applicable copyright laws and terms of service in their jurisdiction.

![PWA Karaoke Screenshot](./screenshot.png)

*My Way, Philippines' most deadly karaoke song, playing in PWA Karaoke.*

## Features
- Use your phone or tablet as a controller and any web-capable device as a display
- Easy-to-use, slick user interface
- Search and queue songs from video streaming platforms
- Supports multiple rooms with password protection
- Operates entirely within the browser

## Downloads
### Releases
Coming soon. In the meantime, you may use the "Clone with Git" or "Download ZIP" methods below.

### Clone with Git
To download the application via `git`, simply clone it using `git clone https://github.com/nedpals/pwa-karaoke.git`.

### Download ZIP
You can download the source code as a ZIP file by clicking "Code" → "Download ZIP" on the GitHub repository page.

## System Requirements
- Minimum 2GB RAM, 1 vCPU
- Docker (if using Docker or Docker Compose)

See the [manual setup prerequisites](#prerequisites) when running without Docker.

## Setup
### Docker Compose
The recommended way to run PWA Karaoke is through Docker Compose. This method simplifies the setup process and ensures that all dependencies are correctly configured.

```bash
./start-docker-app -d
```

`start-docker-app` sets `YTDLP_CHANNEL=nightly` and runs `docker compose up`, forwarding any arguments you pass (such as `-d`). It starts the backend and [Caddy](https://caddyserver.com/) web server.

Visit `http://localhost` or `http://$DOMAIN` (where `$DOMAIN` is your configured domain) to access the application.

The container refreshes `yt-dlp` on every start. Because `start-docker-app` uses the nightly channel, it picks up YouTube fixes before a stable release does. To run on stable instead, bypass the script:

```bash
YTDLP_CHANNEL=stable docker compose up -d
```

### Docker

If you have a custom setup that doesn't use Docker Compose, you can run the backend and frontend services separately using Docker.

```bash
# Build the application
docker build -t pwa-karaoke .

# Run the container
docker run -d -p 8000:8000 --name pwa-karaoke pwa-karaoke
```

Visit `http://localhost:8000` to access the application.

### Local development
Run the backend and the Vite dev server in two terminals. Open the repository root in both.

#### Prerequisites
- [uv](https://docs.astral.sh/uv/), which also downloads the right Python for you
- Node.js 20+
- Docker (optional, for containerized deployment)

Install uv once.

macOS / Linux:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

If you already have Python, `pip install uv` works too. Open a new terminal afterwards so `uv` is on your PATH.

#### Terminal 1: backend
```bash
cd backend
uv sync
uv run python main.py
```

`uv sync` creates `backend/.venv` and installs the locked dependencies, including `yt-dlp`, so there is nothing to activate. To update `yt-dlp` later, run `uv lock --upgrade-package yt-dlp && uv sync`.

##### Using a yt-dlp nightly
If searches work but songs won't play, and the backend logs show "Sign in to confirm you're not a bot" or "Requested format is not available", the stable `yt-dlp` release may be behind YouTube. Install the newest nightly build into the backend's environment and start the server with `--no-sync`:

```bash
cd backend
uv pip install --upgrade "yt-dlp[default,deno]>=0.0.0.dev0"
uv run --no-sync python main.py
```

Keep `--no-sync` every time you start the server. A plain `uv run` puts the locked stable release back without telling you. Check which one you have with `uv run --no-sync yt-dlp --version`: a nightly ends in a long build number, such as `2026.10.10.233141`. To go back to stable, run `uv sync`.

#### Terminal 2: frontend
```bash
cd frontend
npm ci
npm run dev
```

#### Open the app
- On your laptop: `http://localhost:5173`
- On a phone on the same wifi: `http://<your-LAN-IP>:5173`. Vite prints the exact address as `Network:` when it starts.

The dev server proxies API and WebSocket requests to the backend on `http://localhost:8000`, so phones need nothing else. To use a backend running elsewhere, set `VITE_BACKEND_URL` (for example `VITE_BACKEND_URL=http://192.168.1.20:8000 npm run dev`).

> [!NOTE]
> Microphone scoring needs HTTPS. Over plain `http://<LAN-IP>:5173` a phone cannot use its microphone, so the score is generated instead. This is expected.

If you cannot get uv or Node working on your machine, the repository includes a dev container (`.devcontainer/`) that you can open with VS Code or GitHub Codespaces.

### Production build
```bash
# Build frontend and bundle into backend
cd frontend
npm install
npm run build:prod

# Start the server
cd ../backend
uv sync --no-dev
uv run python main.py
```

Visit `http://localhost:8000` to access the application.

## Usage

### Rooms
Rooms let multiple groups run karaoke sessions independently. The home screen has a single room field, filled with a generated name you can replace with your own.

Pressing **Join Room** opens a dialog whose contents depend on the name you entered:
- **The room does not exist yet.** It gets created when you enter, and the dialog offers an optional **Room Password**.
- **The room exists and is open.** You enter straight away.
- **The room exists and is password protected.** The dialog asks for the password before letting you in.

### Modes

The same dialog is where you pick what this device becomes:
- **Enter as Display:** For TVs, projectors, or multiple screens to show the video playback and song queue. It supports playing to multiple displays in near real-time. Not offered on small screens.
- **Enter as Controller:** For phones or tablets to search for songs and control playback.

The quickest way to add a controller is to scan the QR code the display shows while it is waiting.

### Nicknames

A controller asks who is holding it before it joins, and that nickname rides along with every song reserved from it. Reserved songs carry the name in the controller's Reserved tab, and the display shows it beside the song in the banner and on the Up Next card, so a room full of people can tell whose turn is coming.

The name is remembered on the device, so the prompt comes back filled in the next time that phone joins a room. Change it there whenever the phone changes hands. Names run up to 14 characters, which is what fits beside a song title on a phone.

Displays are never asked for a name. Each one generates its own (`Stage 42` and the like) and shows it in the corner status strip, which is handy when several screens share a room.

### Autoplay

Reserved songs play one after another by default: when the current song ends, the display moves straight on to the next one in the queue.

The **Autoplay** toggle in the controller's Player tab turns that off. With it off, a song that ends leaves the queue untouched and the display holds, showing what is up next until someone presses **Next**. If nothing is reserved there is nothing to hold back, so the display returns to its idle screen instead. The setting belongs to the room, so every controller and display in it stays in sync, and the display shows an `Autoplay Off` marker while it is disabled.

Pressing **Next** always skips to the next reserved song, whatever the toggle is set to.

### Scoring

Every song is scored when it ends, and skipping one still scores it. The display spins through digits until the score lands, holds it, then moves on. Anything that played for less than five seconds is not scored.

A controller opens with a **Mic Check**, the same way a display opens with a Sound Check. Allowing it scores singing through the phone's microphone, with the audio staying on the device and only the score sent. Only the remote that reserved the song listens.

Declining, denying the browser, or reaching the app over plain `http`, where microphones are unavailable, leaves the machine to invent the score instead. Both land in the same range.

### Development

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, how to run the checks, and a tour of the code. We follow a [Code of Conduct](CODE_OF_CONDUCT.md) — please read it before participating.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer:** This software is provided "as is" without warranty of any kind. Use at your own risk and ensure compliance with all applicable laws and terms of service.

© 2025 Ned Palacios
