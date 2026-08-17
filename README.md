# PWA Karaoke

A web-based karaoke application that transforms any device into a karaoke system.

> [!IMPORTANT]
> This software is intended for personal, non-commercial use only. Users are responsible for ensuring compliance with applicable copyright laws and terms of service in their jurisdiction.**

![PWA Karaoke Screenshot](./screenshot.png)

*My Way, Philippines' most deadly karaoke song, playing in PWA Karaoke.*

## Features
- Use your phone or tablet as a controller and any web-capable device as a display
- Easy to use and slick user interface
- Search and queue songs video streaming platforms
- Supports multiple rooms with password protection
- Operate entirely within the browser

## Downloads
### Releases
Coming soon. In the meantime, you may use the "Clone with Git" or "Download ZIP" methods below.

### Clone with Git
To download the application via `git`, simply clone it using `git clone https://github.com/username/pwa-karaoke.git`.

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
docker-compose up -d
```

This will start the backend and [Caddy](https://caddyserver.com/) web server.

Visit `http://localhost` or `http://$DOMAIN` (where `$DOMAIN` is your configured domain) to access the application.

### Docker

If you have a custom setup that doesn't use Docker Compose, you can run the backend and frontend services separately using Docker.

```bash
# Build the application
docker build -t pwa-karaoke .

# Run the container
docker run -d -p 8000:8000 --name pwa-karaoke pwa-karaoke
```

Visit `http://localhost:8000` to access the application.

### Manual
A manual setup is also possible. This method requires more steps but allows for greater customization.

#### Prerequisites
Ensure you have the following installed:
- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized deployment)

#### Steps
To set up PWA Karaoke manually, follow the setup procedure below:

```bash
# Build frontend and bundle into backend
cd frontend
npm install
npm run build:prod

# Start the server
cd ../backend
pip install -r requirements.txt
python main.py
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

A song is scored when it ends or when someone skips it. The video and its banner come down, the display switches to a scoring screen, and the digits spin before settling on a number with a rating under it. It then plays the next reserved song, or returns to the idle screen when nothing is waiting.

The leader display decides the score. The server neither computes nor stores one; it passes a reading from a controller to the displays, and passes the leader's verdict back out to the room. Follower displays take the leader's number, so every screen agrees.

The verdict comes from one of two places:

- **Mic scoring on.** The controller measures loudness through the device microphone. It samples the room's noise floor over the first few seconds of the song, then scores the share of the song spent above that floor and how far above it went. Only the resulting 0..1 reading is sent, and it reaches the display without the server doing anything to it.
- **Mic scoring off.** No reading arrives within a second of the song finishing, so the leader generates one, weighted towards the high end.

Both use the same range, so the screen looks the same either way.

A controller opens with a **Mic Check** screen, matching the Sound Check a display opens with. It states what the microphone is used for and offers **Allow Mic** or **Not Now**. A microphone cannot be opened without a user gesture, so that button is what requests one, and the browser permission prompt applies on top of it.

There is no further control for it, only a footnote in the Player tab reporting whether it is on. Skipping the prompt, denying the browser, and plain `http` on a LAN address, where microphones are unavailable, all leave scoring running without one.

Mic scoring only measures the remote that reserved the song, so several phones in one room do not all hear the same singer. The server tells each remote whether the song on screen is theirs, matching on a device id kept in the browser rather than the nickname, which is neither unique nor its own to claim. A reading from any other remote is not passed on, and a song reserved by a remote the server cannot identify falls back to a generated score.

A skipped song is held on screen to be scored the same way one that ended is, so a remote that measured most of it is still heard. Its reveal is shorter and silent. A song that played for less than five seconds is not scored at all.

The reveal is scored by the display with a short synthesised sting, built from oscillators rather than an audio file, so no asset ships with it.

Because no score is kept anywhere, a display connecting midway through a reveal shows the spin without a number and moves on with the rest of the room.

### Development

To contribute to PWA Karaoke, fork the repository and create a new branch for your changes. See the individual README files in the `backend/` and `frontend/` directories for setup instructions. After making your changes, submit a pull request with a clear description of what you've modified.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer:** This software is provided "as is" without warranty of any kind. Use at your own risk and ensure compliance with all applicable laws and terms of service.

© 2025 Ned Palacios
