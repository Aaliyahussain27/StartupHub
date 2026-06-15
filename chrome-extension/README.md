# StartupHub Chrome Extension (Global OS Capture)

This extension implements **Ideation #1: Global OS shortcut (beyond in-app Cmd+K)**. It allows capturing new startup ideas instantly from anywhere on your operating system, even when Chrome is minimized or in the background.

## Features

- **Global Hotkey:** Press `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (Mac) from any application on your computer.
- **Floating Popup Window:** Opens a standalone, glassmorphic capture panel floating on top of your windows.
- **AI Syncing:** Sends the idea directly to the local backend `http://localhost:3001/api/ideas`, running semantic search / duplicate checks automatically.
- **No CORS Obstacles:** Backed by a background service worker message proxy.

## Installation

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` (Developer Mode).
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this folder (`c:\Amy\College\Hackathon\OSC AI Build\StartupHub\chrome-extension`).

## Testing

1. Ensure the backend server is running (`npm run dev` in `backend` folder).
2. Press **`Ctrl+Shift+Y`** (Windows) or **`Cmd+Shift+Y`** (Mac).
3. The standalone Idea Capture floating panel should appear.
4. Enter an Idea Title and Description, then press **Capture Idea**.
5. The idea will immediately show up in the **Inbox** list on the main StartupHub dashboard (without reloading!).
