import fs from 'fs';
import path from 'path';
import { extractMetadata } from '../services/metadata/metadataService.js';
import { transcodeOrRemux, killActiveTranscode } from '../services/transcode/transcodeService.js';
import { validatePath } from './movieController.js';

/**
 * Dynamic on-the-fly movie streaming controller
 * GET /api/movie/:id/stream
 */
export const streamMovie = async (req, res) => {
  const { id } = req.params; // base64url path ID
  const start = parseFloat(req.query.start) || 0;
  
  // Retrieve client-reported capabilities
  const browserVideo = (req.query.browser_video || 'h264').split(',').map(v => v.trim().toLowerCase());
  const browserAudio = (req.query.browser_audio || 'aac,mp3').split(',').map(a => a.trim().toLowerCase());
  const browserContainers = (req.query.browser_containers || 'mp4').split(',').map(c => c.trim().toLowerCase());

  // Session keys for active transcode kill triggers
  const sessionId = req.query.sessionId || '';
  const sessionKey = `session_${req.user.id}_${id}${sessionId ? `_${sessionId}` : ''}`;

  try {
    const filePath = Buffer.from(id, 'base64url').toString('utf8');

    if (!fs.existsSync(filePath) || !validatePath(filePath)) {
      return res.status(404).json({ error: 'Movie file not found or access denied.' });
    }

    // Probe movie characteristics on-the-fly
    const movie = await extractMetadata(filePath);

    const videoCodec = (movie.video_codec || '').toLowerCase();
    const audioCodec = (movie.audio_codec || '').toLowerCase();
    const container = (movie.container || '').toLowerCase();

    // Compatibility check
    const canDirectPlayVideo = browserVideo.includes(videoCodec);
    const canDirectPlayAudio = browserAudio.includes(audioCodec);
    const isSupportedContainer = browserContainers.some(c => container.includes(c));

    let decisionMode = 'transcode';
    let transcodeVideo = !canDirectPlayVideo;
    let transcodeAudio = !canDirectPlayAudio;

    if (canDirectPlayVideo && canDirectPlayAudio && isSupportedContainer && start === 0) {
      decisionMode = 'direct';
    } else if (canDirectPlayVideo && canDirectPlayAudio) {
      decisionMode = 'remux';
      transcodeVideo = false;
      transcodeAudio = false;
    } else {
      decisionMode = 'transcode';
    }

    // Set debugging/UI info headers
    res.setHeader('X-Play-Mode', decisionMode);
    res.setHeader('X-Transcode-Video', transcodeVideo ? 'true' : 'false');
    res.setHeader('X-Transcode-Audio', transcodeAudio ? 'true' : 'false');

    if (decisionMode === 'direct') {
      console.log(`[Direct Play] Streaming ${path.basename(filePath)} directly`);
      killActiveTranscode(sessionKey);
      return handleRangeRequest(filePath, req, res);
    } else {
      return transcodeOrRemux(filePath, {
        start,
        transcodeVideo,
        transcodeAudio,
        sessionKey
      }, res, req);
    }

  } catch (error) {
    console.error('Streaming error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initiate media stream.' });
    }
  }
};

/**
 * Range requests for direct playing files
 */
function handleRangeRequest(filePath, req, res) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    return res.status(404).send('File not found.');
  }

  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.mkv') contentType = 'video/x-matroska';

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });

    fileStream.pipe(res);
  } else {
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.mkv') contentType = 'video/x-matroska';

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });

    fs.createReadStream(filePath).pipe(res);
  }
}
