@echo off
rem OddlyClever Music: first run sets itself up, then opens in your browser.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Setting up the first time...
  python -m venv .venv || (echo Python 3.10+ is needed: https://www.python.org/downloads/ & pause & exit /b 1)
  .venv\Scripts\python -m pip install -q -r requirements.txt || (echo Could not install the requirements. & pause & exit /b 1)
)
.venv\Scripts\python -c "import ytmusicapi" 2>nul || .venv\Scripts\python -m pip install -q -r requirements.txt
where ffmpeg >nul 2>nul || echo Note: ffmpeg is not on PATH, so cover art and tags can't be added. Install it with: winget install Gyan.FFmpeg
start "" http://127.0.0.1:8790
.venv\Scripts\python server.py
