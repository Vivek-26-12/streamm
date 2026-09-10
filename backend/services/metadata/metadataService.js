import ffmpeg from '../../config/ffmpeg.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Extracts metadata from a media file using ffprobe.
 * @param {string} filePath - Absolute path to the media file.
 * @returns {Promise<Object>} Formatted metadata object.
 */
export const extractMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        return reject(err);
      }

      const format = data.format || {};
      const streams = data.streams || [];

      // Find primary video and audio streams
      const videoStream = streams.find(s => s.codec_type === 'video');
      const audioStream = streams.find(s => s.codec_type === 'audio');
      
      // Parse subtitles
      const subtitleStreams = streams
        .filter(s => s.codec_type === 'subtitle')
        .map((s, index) => ({
          streamIndex: s.index,
          codec: s.codec_name,
          language: s.tags?.language || s.tags?.title || `track_${index + 1}`,
          title: s.tags?.title || s.tags?.language || `Subtitle Track ${index + 1}`
        }));

      // Extract general attributes
      const duration = parseFloat(format.duration) || 0;
      const file_size = parseInt(format.size) || 0;
      const container = format.format_name || '';
      const bitrate = parseInt(format.bit_rate) || 0;

      // Video attributes
      const video_codec = videoStream ? videoStream.codec_name : 'unknown';
      const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown';
      const frame_rate = videoStream ? videoStream.r_frame_rate : 'unknown';
      const aspect_ratio = videoStream ? videoStream.display_aspect_ratio : 'unknown';

      // Audio attributes
      const audio_codec = audioStream ? audioStream.codec_name : 'unknown';
      const language = audioStream?.tags?.language || 'unknown';

      // Extract a clean title from the filename
      const filename = path.basename(filePath);
      const title = cleanFileNameToTitle(filename);

      resolve({
        title,
        file_path: filePath,
        file_size,
        container,
        video_codec,
        audio_codec,
        duration,
        resolution,
        bitrate,
        frame_rate,
        aspect_ratio,
        language,
        subtitles: subtitleStreams
      });
    });
  });
};

/**
 * Parses filenames to extract titles (handling years, episodes, etc.)
 */
function cleanFileNameToTitle(filename) {
  const ext = path.extname(filename);
  let base = filename.slice(0, -ext.length);

  // Clean common scene tags
  base = base.replace(/\[.*?\]|\(.*?\)/g, '').trim(); // Remove brackets like [1080p] or (2024) first if outer
  
  // Match year: e.g., Movie Name (2024)
  const yearMatch = base.match(/(.+?)\s*\((\d{4})\)/);
  if (yearMatch) {
    return `${yearMatch[1].trim()} (${yearMatch[2]})`;
  }

  // Match TV episode or Anime: e.g., Breaking Bad S01E02 or One Piece - 1105
  // We can leave dashes in titles for anime or TV shows, but replace dots and underscores with spaces
  let title = base.replace(/[\._]/g, ' ').trim();
  
  return title;
}
