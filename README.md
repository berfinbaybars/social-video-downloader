# TikTok & Instagram Video Downloader

A local app for downloading 1–20 TikTok or Instagram videos into the repository’s output folder. Mix both platforms in one job. Files are numbered in link order and saved as H.264/AAC MP4s for editing apps such as CapCut.

## Requirements

- Node.js 20 or newer (includes npm).
- yt-dlp, ffmpeg, and ffprobe installed and available on PATH. FFmpeg must include libx264.
- Internet access to the video platforms.

Install Node.js from https://nodejs.org/, yt-dlp using https://github.com/yt-dlp/yt-dlp#installation, and FFmpeg using https://ffmpeg.org/download.html. Follow the instructions for your operating system. Restart your terminal after changing PATH.

Verify installation with `node --version`, `yt-dlp --version`, `ffmpeg -version`, and `ffprobe -version`.

## Run from a clone

1. Clone this repository and open a terminal in its folder.
2. Run `npm start`. There are no npm dependencies to install.
3. Open http://127.0.0.1:4173.
4. Enter a project name and add up to 20 video links, optionally entering filename labels.
5. Click **Download videos** to start downloading immediately.

A new timestamped project folder is created inside `output/` in the repository, containing `videos/` and `downloads.json`. Blank labels use the TikTok creator and first five video-ID digits, or the Instagram post code. Videos are converted to compatible MP4s, which can take time for large batches.

The output location is relative to the app’s source files, regardless of your terminal’s working directory. The server listens on localhost only and is intended for local use.

Private, restricted, or login-required posts may not download. Keep yt-dlp updated when platforms change. Only download videos you are authorized to use.

## Development

Run `npm test` for validation and naming tests. `/api/health` reports tool availability. No local paths, credentials, browser cookies, or downloaded videos are required in the repository. Downloaded files in `output/` and `downloads/` are ignored by Git; keep any other chosen download location outside the checkout.

The checkout may still be called resolve-compilation-builder; the app no longer needs Resolve or generates editing timelines.
