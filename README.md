# PWA Karaoke

A web-based karaoke application that transforms any device into a karaoke system.

![PWA Karaoke Screenshot](./screenshot.png)

*My Way, Philippines' most sang karaoke song, performed using PWA Karaoke.*

## Features

- Use your phone or tablet as a controller and any web-capable device as a display
- Easy to use and slick user interface
- Search and queue songs from YouTube
- Operate entirely within the browser

## Downloads

### Releases

Coming soon. In the meantime, you may use the "Clone with Git" or "Download ZIP" methods below.

### Clone with Git

To download the application via `git`, simply clone it using `git clone https://github.com/username/pwa-karaoke.git`.

### Download ZIP

You can download the source code as a ZIP file by clicking "Code" → "Download ZIP" on the GitHub repository page.

## Prerequisites
- Python 3.8+
- Node.js 20+

## Setup
Before running the application, make sure to build the applications by using the following commands below:

```bash
# Build frontend and bundle into backend
cd frontend
npm install
npm run build:backend

# Start the server
cd ../backend
pip install -r requirements.txt
python main.py
```

Visit `http://localhost:8000` to access the application.

### Usage

After starting the production server, open your browser to `http://localhost:8000` and choose your mode. Use Display Mode on TVs or projectors to show video playback and the song queue. Use Controller Mode on phones or tablets to search for songs and control playback. Controllers can search and queue songs, which will appear on the display.

### Development

To contribute to PWA Karaoke, fork the repository and create a new branch for your changes. See the individual README files in the `backend/` and `frontend/` directories for setup instructions. After making your changes, submit a pull request with a clear description of what you've modified.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

© 2024 Ned Palacios