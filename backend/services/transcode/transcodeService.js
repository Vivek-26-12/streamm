import { exec } from 'child_process';
import ffmpeg from '../../config/ffmpeg.js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';

let supportedEncoders = [];
const activeTranscodes = new Map(); // Key: sessionKey, Value: ffmpeg process

/**
 * Runs a quick 1-second test encoding to see if a GPU encoder works on the hardware driver level
 */
const testEncoderHardware = (encoderName) => {
  return new Promise((resolve) => {
    const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
    exec(`"${ffmpegPath}" -f lavfi -i testsrc=duration=1:size=128x128 -c:v ${encoderName} -f null -`, (err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

/**
 * Detect supported FFmpeg video encoders (runs on startup)
 */
export const detectEncoders = () => {
  return new Promise((resolve) => {
    const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
    exec(`"${ffmpegPath}" -encoders`, async (err, stdout) => {
      if (err) {
        console.error('Error detecting FFmpeg encoders:', err.message);
        supportedEncoders = ['libx264']; // safe fallback
        return resolve(supportedEncoders);
      }
      
      const compiledEncoders = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/\sV\S*\s(\S+)/);
        if (match) {
          compiledEncoders.push(match[1]);
        }
      }
      
      const gpuCandidates = ['h264_nvenc', 'h264_qsv', 'h264_amf'];
      const verifiedGpuEncoders = [];

      for (const candidate of gpuCandidates) {
        if (compiledEncoders.includes(candidate)) {
          console.log(`Testing GPU encoder "${candidate}" driver compatibility...`);
          const isHardwareCompatible = await testEncoderHardware(candidate);
          if (isHardwareCompatible) {
            console.log(`GPU encoder "${candidate}" is compatible and active!`);
            verifiedGpuEncoders.push(candidate);
          } else {
            console.log(`GPU encoder "${candidate}" failed hardware driver check. Disabling.`);
          }
        }
      }

      supportedEncoders = [...verifiedGpuEncoders, 'libx264'];
      console.log('Final hardware-acceleration active encoders:', supportedEncoders);
      resolve(supportedEncoders);
    });
  });
};

/**
 * Checks which H.264 encoder is best suited for the hardware
 */
export const getBestVideoEncoder = () => {
  if (process.env.GPU_ACCEL === 'none') {
    return 'libx264';
  }
  
  if (supportedEncoders.includes('h264_nvenc')) {
    console.log('Using Hardware Acceleration: NVIDIA NVENC');
    return 'h264_nvenc';
  }
  if (supportedEncoders.includes('h264_qsv')) {
    console.log('Using Hardware Acceleration: Intel QSV');
    return 'h264_qsv';
  }
  if (supportedEncoders.includes('h264_amf')) {
    console.log('Using Hardware Acceleration: AMD AMF');
    return 'h264_amf';
  }
  
  return 'libx264'; // CPU fallback
};

/**
 * Kills any active transcoding process for a specific session
 * @param {string} sessionKey 
 */
export const killActiveTranscode = (sessionKey) => {
  if (activeTranscodes.has(sessionKey)) {
    const ffmpegCmd = activeTranscodes.get(sessionKey);
    console.log(`Killing active transcode stream for session: ${sessionKey}`);
    try {
      ffmpegCmd.kill('SIGKILL');
    } catch (e) {
      console.error(`Error killing transcode for session ${sessionKey}:`, e.message);
    }
    activeTranscodes.delete(sessionKey);
  }
};

/**
 * Transcodes or remuxes a video file on-the-fly and streams it to the HTTP response.
 * @param {string} filePath - Path to video file
 * @param {object} options - Transcoding options { start, transcodeVideo, transcodeAudio, sessionKey }
 * @param {object} res - Express response
 */
export const transcodeOrRemux = (filePath, options, res, req) => {
  const { start = 0, transcodeVideo = false, transcodeAudio = false, sessionKey } = options;

  if (sessionKey) {
    killActiveTranscode(sessionKey);
  }

  const range = req?.headers?.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const rangeStart = parseInt(parts[0], 10);
    const rangeEnd = parts[1] ? parseInt(parts[1], 10) : null;

    if (rangeStart === 0 && rangeEnd === 1) {
      // Respond to iOS range probe request with exactly 2 bytes of dummy data
      res.writeHead(206, {
        'Content-Range': 'bytes 0-1/2',
        'Content-Length': '2',
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      });
      res.write(Buffer.from([0x00, 0x00]));
      res.end();
      return;
    }
  }

  // Serve the main stream as a progressive 200 OK chunked response
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Transfer-Encoding': 'chunked'
  });

  console.log(`Starting stream for ${path.basename(filePath)} | Seek: ${start}s | Transcode Video: ${transcodeVideo} | Transcode Audio: ${transcodeAudio}`);

  const cmd = ffmpeg();

  cmd.input(filePath);

  if (start > 0) {
    cmd.inputOption('-ss', start.toString());
  }

  // Video settings
  if (transcodeVideo) {
    const encoder = getBestVideoEncoder();
    cmd.videoCodec(encoder);
    
    if (encoder === 'libx264') {
      cmd.outputOptions([
        '-preset', 'ultrafast',
        '-crf', '23',
        '-tune', 'zerolatency'
      ]);
    } else if (encoder === 'h264_nvenc') {
      cmd.outputOptions([
        '-preset', 'fast',
        '-zerolatency', '1'
      ]);
    } else {
      // For Intel QSV (h264_qsv), AMD (h264_amf), etc.
      cmd.outputOptions([
        '-preset', 'fast'
      ]);
    }
    
    cmd.outputOption('-pix_fmt', 'yuv420p');
  } else {
    cmd.videoCodec('copy');
  }

  // Audio settings
  if (transcodeAudio) {
    cmd.audioCodec('aac');
    cmd.audioBitrate('192k');
    cmd.audioChannels(2);
  } else {
    cmd.audioCodec('copy');
  }

  // Fragmented MP4 options & muxing queue sizing to prevent overflows on dual-audio tracks
  cmd.format('mp4');
  cmd.outputOptions([
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-max_muxing_queue_size', '9999'
  ]);

  res.on('close', () => {
    console.log(`Client closed connection for session ${sessionKey}`);
    killActiveTranscode(sessionKey);
  });

  cmd.on('error', (err) => {
    if (err.message && !err.message.includes('Output stream closed') && !err.message.includes('SIGKILL')) {
      console.error(`FFmpeg error for session ${sessionKey}:`, err.message);
      if (!res.headersSent) {
        res.status(500).send('Streaming error.');
      }
    }
    killActiveTranscode(sessionKey);
  });

  cmd.on('end', () => {
    console.log(`Finished streaming session ${sessionKey}`);
    activeTranscodes.delete(sessionKey);
  });

  activeTranscodes.set(sessionKey, cmd);

  cmd.pipe(res, { end: true });
};
