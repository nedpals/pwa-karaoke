# PWA Karaoke

A karaoke application with a display screen and controller interface.

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Start the backend server (runs on port 8000)
2. Start the frontend development server
3. Open the display page at `/display`
4. Open the controller page at `/controller` on mobile devices
5. Controllers can search and queue songs, which appear on the display

## Architecture

- **Backend**: Python WebSocket server for real-time communication
- **Frontend**: React application with TypeScript
- **Display Page**: Shows video playback and current queue
- **Controller Page**: Mobile-friendly interface for song selection and playback control