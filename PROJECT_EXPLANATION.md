# Streamm - Self-Hosted Media Streaming Server
## Technical Architecture & Interview Preparation Guide

This guide details the technical implementation, architecture decisions, and core engineering principles of **Streamm** to help you explain the project during your technical interviews.

---

## 1. System Architecture Overview

Streamm is a light-weight, high-performance, self-hosted personal media streaming platform. It follows a client-server architecture optimized for low-latency streaming and smart hardware utilization.

```
+------------------------------------------+
|  React Frontend / iOS Safari / Chrome   |
+---------------------+--------------------+
                      |
           (Cloudflare Tunnel / HTTPS)
                      |
                      v
+---------------------++-------------------+
|       Express.js Backend Server          |
+---------------------+--------------------+
                      |
            (Spawn Child Process)
                      v
+---------------------+--------------------+
|       FFmpeg Transcoding Engine          |
+---------------+------------------+-------+
                |                  |
   (Hardware Accel)              (Local Disk Read)
                v                  v
+---------------+-------+ +--------+--------+
| Intel QSV GPU Encoder | | D: Drive Media |
+-----------------------+ +----------------+
```

### Core Stack
*   **Frontend**: React (Vite), Tailwind CSS, React Router.
*   **Backend**: Node.js, Express.js.
*   **Streaming & Transcoding Engine**: FFmpeg & FFprobe (managed via `fluent-ffmpeg`).
*   **Networking / Tunneling**: Cloudflare Tunnel (`cloudflared`).

---

## 2. Key Engineering Highlights (What to talk about)

If an interviewer asks you, *"What were the most challenging engineering problems you solved in this project?"*, you should highlight these three items:

### A. Dynamic GPU Hardware Acceleration Probing
*   **Problem**: You cannot hardcode a GPU encoder because different hosts have different hardware. Hardcoding NVENC (NVIDIA) crashes systems with Intel or AMD graphics.
*   **Solution**: You built a **boot-time validation engine** in `backend/services/transcode/transcodeService.js`. When the server starts up, it automatically performs short test transcodes using candidate codecs (`h264_qsv` for Intel, `h264_nvenc` for NVIDIA, `h264_amf` for AMD) to verify driver compatibility. The server automatically falls back to CPU encoding (`libx264`) only if no GPU driver is verified active.
*   **Result**: Zero manual server configuration is required when shifting hosting environments.

### B. Overcoming iOS / Safari Streaming Strictness (HTTP 206 Handshake)
*   **Problem**: iOS Safari is notorious for refusing to play progressive video streams (`200 OK`) and failing with silent black screens or infinite loading indicators.
*   **Solution**: iOS Safari performs a strict two-step handshake:
    1.  First, it requests `Range: bytes=0-1` to verify if the server supports range requests. If the server floods it with too much data, Safari rejects the connection.
    2.  Once validated, it requests the full stream.
    We resolved this by writing a custom HTTP range parser. When `bytes=0-1` is detected, the server returns exactly `206 Partial Content` with 2 dummy bytes. For the main request, it delivers the progressive video stream cleanly.
*   **Result**: Flawless Safari and iPhone browser playback.

### C. Live Video Remuxing vs. Transcoding
*   **Problem**: Transcoding 1085p video in real-time is extremely CPU/GPU intensive.
*   **Solution**: You implemented a smart detection filter. Before spawning an FFmpeg process, the backend runs FFprobe to inspect the source file container, video codec, and audio codec. If the source file is already H.264 video and AAC audio inside an MKV container, the server performs **stream remuxing** (`-c:v copy -c:a copy`) to put it into an MP4 container on-the-fly. This uses **0% CPU/GPU** resources.

---

## 3. Likely Interview Q&A

### Q1: Why didn't you use a database like SQLite or MongoDB?
> **Answer:** "Since the platform operates directly on a local folder of media files, the file system itself acts as our single source of truth. Implementing a database would introduce synchronization overhead (dealing with files deleted or renamed outside the app). Instead, we parse metadata dynamically using fast FFprobe queries, ensuring the app remains stateless and runs with zero database configurations."

### Q2: How does the server handle scrubbing (seeking) in a live transcoded stream?
> **Answer:** "When a user seeks to a timestamp (e.g., 30 minutes in), the frontend player sends a request to the backend with a query parameter `start=1800`. The backend terminates any running FFmpeg process for that user, spawns a new FFmpeg process, inputs the offset parameter `-ss 1800` *before* loading the file input (allowing fast input seeking), and pipes the new stream segment directly into the HTTP response. The React player swaps the source URL synchronously to prevent browser-native autoplay blocks."

### Q3: What is the purpose of the Cloudflare Tunnel? Why not just port forward?
> **Answer:** "Port forwarding exposes a home network's public IP address directly to the internet, leaving it vulnerable to attacks. Using a Cloudflare Tunnel creates a secure outbound connection from the local Node.js server to Cloudflare's edge network. The user gets a secure public HTTPS URL with built-in SSL certification and DDoS protection without opening any inbound ports on their router."

### Q4: Why did you convert the files to MP4 (H.264 / AAC)?
> **Answer:** "H.264 video and AAC audio inside an MP4 container are universally supported by all HTML5 browsers without plugins. By converting the library beforehand using our batch utility, we enabled 'Direct Play'. The browser downloads the MP4 file progressively via native range requests, resulting in instant timeline seeking and zero server-side processing overhead."
