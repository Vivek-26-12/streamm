import ffmpeg from '../../config/ffmpeg.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const POSTER_CACHE_DIR = process.env.POSTER_CACHE_DIR || 'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\cache\\posters';

// Ensure the directory exists
if (!fs.existsSync(POSTER_CACHE_DIR)) {
  fs.mkdirSync(POSTER_CACHE_DIR, { recursive: true });
}

/**
 * Generates a poster image from a video file.
 * @param {string} movieFilePath - Absolute path of the video.
 * @param {number} movieId - Unique database ID of the movie.
 * @param {number} durationSeconds - Total duration of the video.
 * @returns {Promise<string|null>} Path to the generated poster or null.
 */
export const generatePoster = (movieFilePath, movieId, durationSeconds) => {
  return new Promise((resolve) => {
    const posterFilename = `poster_${movieId}.jpg`;
    const posterPath = path.join(POSTER_CACHE_DIR, posterFilename);

    // If poster already exists, return the cached path
    if (fs.existsSync(posterPath)) {
      return resolve(posterPath);
    }

    // Capture screen around 15 seconds, or 10% if video is short
    const timestamp = Math.min(15, durationSeconds * 0.1);

    ffmpeg(movieFilePath)
      .screenshots({
        timestamps: [timestamp],
        filename: posterFilename,
        folder: POSTER_CACHE_DIR,
        size: '480x720' // 2:3 poster aspect ratio
      })
      .on('end', () => {
        resolve(posterPath);
      })
      .on('error', (err) => {
        console.error(`Failed to generate poster for movie ID ${movieId}:`, err.message);
        resolve(null);
      });
  });
};
