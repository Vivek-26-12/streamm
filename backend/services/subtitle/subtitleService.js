import ffmpeg from '../../config/ffmpeg.js';
import fs from 'fs';

/**
 * Streams an internal subtitle track converted to WebVTT format on-the-fly.
 * @param {string} moviePath - Path to the movie file.
 * @param {number} streamIndex - FFmpeg stream index of the subtitle track.
 * @param {object} res - Express response object.
 */
export const streamInternalSubtitle = (moviePath, streamIndex, res) => {
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');

  const ffmpegProcess = ffmpeg(moviePath)
    .addOption('-map', `0:${streamIndex}`)
    .format('webvtt')
    .on('error', (err) => {
      console.error(`Subtitle extraction error for index ${streamIndex}:`, err.message);
      if (!res.headersSent) {
        res.status(500).send('Error extracting subtitles.');
      }
    });

  ffmpegProcess.pipe(res, { end: true });
};

/**
 * Streams an external subtitle file (.srt, .ass) converted to WebVTT on-the-fly.
 * @param {string} subPath - Path to the subtitle file.
 * @param {object} res - Express response object.
 */
export const streamExternalSubtitle = (subPath, res) => {
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');

  if (subPath.endsWith('.vtt')) {
    fs.createReadStream(subPath).pipe(res);
    return;
  }

  const ffmpegProcess = ffmpeg(subPath)
    .format('webvtt')
    .on('error', (err) => {
      console.error(`External subtitle conversion error:`, err.message);
      if (!res.headersSent) {
        res.status(500).send('Error converting subtitles.');
      }
    });

  ffmpegProcess.pipe(res, { end: true });
};
