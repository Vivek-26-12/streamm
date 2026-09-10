import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { extractMetadata } from '../services/metadata/metadataService.js';
import { generatePoster } from '../services/thumbnail/posterService.js';
import { streamInternalSubtitle, streamExternalSubtitle } from '../services/subtitle/subtitleService.js';

dotenv.config();

// Media file extensions to scan
const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.flv', '.ts', '.3gp'
]);

/**
 * Helper to get configured library paths
 */
const getLibraryPaths = () => {
  const pathsString = process.env.LIBRARY_PATHS || '';
  return pathsString
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

/**
 * Validate that a target path belongs to configured library paths (Path Traversal Protection)
 */
export const validatePath = (targetPath) => {
  const resolvedTarget = path.resolve(targetPath);
  const libraryPaths = getLibraryPaths();

  for (const libPath of libraryPaths) {
    const resolvedLib = path.resolve(libPath);
    if (resolvedTarget.startsWith(resolvedLib)) {
      return true;
    }
  }
  return false;
};

/**
 * Get list of all movies dynamically from directories on request
 */
export const getMovies = async (req, res) => {
  const { q, codec, sort } = req.query;
  const libraryPaths = getLibraryPaths();
  const movies = [];

  // Helper recursive directory scanner
  const scanDir = (dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const fullPath = path.resolve(path.join(dirPath, file));
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (MEDIA_EXTENSIONS.has(ext)) {
            // Title extraction from filename
            const title = cleanFileNameToTitle(file);

            // Filter by search query
            if (q && !title.toLowerCase().includes(q.toLowerCase())) {
              continue;
            }

            movies.push({
              id: Buffer.from(fullPath).toString('base64url'),
              title,
              container: ext.replace('.', ''),
              file_size: stat.size,
              added_at: stat.birthtime,
              file_path_relative: path.basename(fullPath),
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error reading library path ${dirPath}:`, err.message);
    }
  };

  // Perform dynamic scan
  libraryPaths.forEach(scanDir);

  // Sorting
  if (sort === 'title_asc') {
    movies.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'title_desc') {
    movies.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sort === 'added_at_asc') {
    movies.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
  } else {
    // Default recently added
    movies.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
  }

  // Inject poster link
  const cleanedMovies = movies.map(m => ({
    ...m,
    poster_path: `/api/movie/${m.id}/poster`
  }));

  return res.json(cleanedMovies);
};

/**
 * Dynamic on-the-fly FFprobe parsing for selected movie
 */
export const getMovieById = async (req, res) => {
  const { id } = req.params;

  try {
    const filePath = Buffer.from(id, 'base64url').toString('utf8');

    if (!fs.existsSync(filePath) || !validatePath(filePath)) {
      return res.status(404).json({ error: 'Movie file not found or access denied.' });
    }

    // Extract FFprobe metadata on-the-fly
    const meta = await extractMetadata(filePath);
    const stat = fs.statSync(filePath);

    // Map internal subtitles to include unified schema properties (id, type)
    const subtitles = meta.subtitles.map(sub => ({
      id: sub.streamIndex.toString(),
      language: sub.language,
      type: 'internal',
      codec: sub.codec,
      title: sub.title
    }));
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    try {
      const files = fs.readdirSync(dir);
      const subExtensions = ['.srt', '.ass', '.vtt'];

      const subFiles = files.filter(file => {
        const fileExt = path.extname(file).toLowerCase();
        if (!subExtensions.includes(fileExt)) return false;
        return file.startsWith(baseName);
      });

      subFiles.forEach((subFile) => {
        const fullSubPath = path.join(dir, subFile);
        const subExt = path.extname(subFile).toLowerCase().replace('.', '');
        const subParts = subFile.split('.');
        
        let lang = 'unknown';
        if (subParts.length > 2) {
          lang = subParts[subParts.length - 2];
        }

        subtitles.push({
          id: Buffer.from(fullSubPath).toString('base64url'),
          language: lang,
          type: 'external',
          codec: subExt,
          title: `External ${lang.toUpperCase()} (${subExt.toUpperCase()})`
        });
      });
    } catch (e) {
      console.error('Failed to scan external subtitles:', e.message);
    }

    return res.json({
      id,
      title: meta.title,
      file_size: stat.size,
      container: meta.container,
      video_codec: meta.video_codec,
      audio_codec: meta.audio_codec,
      duration: meta.duration,
      resolution: meta.resolution,
      bitrate: meta.bitrate,
      frame_rate: meta.frame_rate,
      aspect_ratio: meta.aspect_ratio,
      language: meta.language,
      poster_path: `/api/movie/${id}/poster`,
      subtitles
    });

  } catch (error) {
    console.error('Error fetching movie details:', error);
    return res.status(550).json({ error: 'Failed to retrieve movie details.' });
  }
};

/**
 * Serve poster frame (generate on-the-fly and cache if not present)
 */
export const getPoster = async (req, res) => {
  const { id } = req.params;

  try {
    const filePath = Buffer.from(id, 'base64url').toString('utf8');

    if (!fs.existsSync(filePath) || !validatePath(filePath)) {
      return res.status(404).send('Movie not found.');
    }

    // Check if poster cache directory exists
    const cacheDir = process.env.POSTER_CACHE_DIR || 'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\cache\\posters';
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cachedPosterPath = path.join(cacheDir, `poster_${id}.jpg`);

    if (fs.existsSync(cachedPosterPath)) {
      return res.sendFile(path.resolve(cachedPosterPath));
    }

    // Probe duration on-the-fly to find screenshot mark
    const meta = await extractMetadata(filePath);
    const posterPath = await generatePoster(filePath, id, meta.duration);

    if (posterPath && fs.existsSync(posterPath)) {
      return res.sendFile(path.resolve(posterPath));
    }

    return res.status(404).send('Poster not found.');
  } catch (error) {
    console.error('Error serving poster:', error.message);
    return res.status(500).send('Internal server error.');
  }
};

/**
 * Stream subtitle tracks converted on-the-fly to WebVTT
 */
export const getSubtitle = async (req, res) => {
  const { id } = req.params; // Movie base64 ID
  const { subId } = req.query; // Internal stream index OR External base64 sub path

  if (!subId) {
    return res.status(400).json({ error: 'Subtitle ID (subId) query parameter is required.' });
  }

  try {
    const moviePath = Buffer.from(id, 'base64url').toString('utf8');
    if (!fs.existsSync(moviePath) || !validatePath(moviePath)) {
      return res.status(404).json({ error: 'Movie file not found.' });
    }

    // Check if subId is an internal stream index (digits) or external base64 path
    if (/^\d+$/.test(subId)) {
      // Internal
      const streamIndex = parseInt(subId, 10);
      streamInternalSubtitle(moviePath, streamIndex, res);
    } else {
      // External
      const subPath = Buffer.from(subId, 'base64url').toString('utf8');
      if (!fs.existsSync(subPath) || !validatePath(subPath)) {
        return res.status(404).json({ error: 'Subtitle file not found.' });
      }
      streamExternalSubtitle(subPath, res);
    }
  } catch (error) {
    console.error('Error serving subtitles:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to retrieve subtitle track.' });
    }
  }
};

/**
 * Empty trigger scanner stub
 */
export const triggerScan = async (req, res) => {
  return res.json({ message: 'Dynamic platform refreshes instantly, scanning unnecessary.' });
};

/**
 * Filename parsing helper
 */
function cleanFileNameToTitle(filename) {
  const ext = path.extname(filename);
  let base = filename.slice(0, -ext.length);

  base = base.replace(/\[.*?\]|\(.*?\)/g, '').trim();
  
  const yearMatch = base.match(/(.+?)\s*\((\d{4})\)/);
  if (yearMatch) {
    return `${yearMatch[1].trim()} (${yearMatch[2]})`;
  }

  return base.replace(/[\._]/g, ' ').trim();
}
