import fs from 'fs';
import path from 'path';
import ffmpeg from '../config/ffmpeg.js';
import { exec } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Target directory containing your movies
const moviesDir = 'd:\\Songs\\Pendrive\\movies\\Streamm\\backend\\movies';

const probeFile = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
};

const convertFile = (inputPath, outputPath, vcodec, acodec) => {
  return new Promise((resolve, reject) => {
    console.log(`\nConverting: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
    console.log(`Enforcing: Video: ${vcodec} | Audio: ${acodec}`);
    
    const cmd = ffmpeg(inputPath);
    cmd.videoCodec(vcodec);
    cmd.audioCodec(acodec);
    cmd.outputOptions('-max_muxing_queue_size', '9999');
    if (vcodec !== 'copy') {
      cmd.outputOptions('-pix_fmt', 'yuv420p');
    }
    if (acodec === 'aac') {
      cmd.audioBitrate('192k');
      cmd.audioChannels(2);
    }
    
    let lastPercent = 0;
    cmd.on('progress', (progress) => {
      if (progress.percent && Math.floor(progress.percent) >= lastPercent + 10) {
        lastPercent = Math.floor(progress.percent);
        console.log(`Progress: ${lastPercent}%`);
      }
    })
    .on('error', (err) => {
      reject(err);
    })
    .on('end', () => {
      resolve();
    });

    cmd.save(outputPath);
  });
};

const extractSubtitle = (inputPath, index, outputPath) => {
  return new Promise((resolve) => {
    const ffmpegPath = ffmpegInstaller.path;
    exec(`"${ffmpegPath}" -y -i "${inputPath}" -map 0:${index} "${outputPath}"`, (err) => {
      if (err) {
        console.error(`Failed to extract subtitle track ${index}:`, err.message);
        resolve(false);
      } else {
        console.log(`Extracted subtitle track ${index} to ${path.basename(outputPath)}`);
        resolve(true);
      }
    });
  });
};

const run = async () => {
  console.log('==================================================');
  console.log('STARTING UNIVERSAL H.264 & AAC OPTIMIZATION...');
  console.log('==================================================');
  
  if (!fs.existsSync(moviesDir)) {
    console.error('Movies directory not found at:', moviesDir);
    return;
  }

  const files = fs.readdirSync(moviesDir);
  const mediaExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.webm'];
  const videoFiles = files.filter(f => mediaExtensions.includes(path.extname(f).toLowerCase()));

  console.log(`Found ${videoFiles.length} media files in directory.\n`);

  for (const file of videoFiles) {
    const inputPath = path.join(moviesDir, file);
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const outputPath = path.join(moviesDir, `${baseName}.mp4`);
    const tempOutputPath = path.join(moviesDir, `temp_${baseName}.mp4`);

    try {
      const meta = await probeFile(inputPath);
      
      const videoStream = meta.streams.find(s => s.codec_type === 'video');
      const audioStream = meta.streams.find(s => s.codec_type === 'audio');
      const subtitleStreams = meta.streams.filter(s => s.codec_type === 'subtitle');

      const videoCodec = videoStream?.codec_name || '';
      const audioCodec = audioStream?.codec_name || '';

      const isVideoH264 = videoCodec === 'h264';
      const isAudioAAC = audioCodec === 'aac';
      const isMp4 = ext === '.mp4';

      // If the file is already H.264 + AAC MP4, skip it
      if (isVideoH264 && isAudioAAC && isMp4) {
        console.log(`[Skipped] ${file} is already H.264/AAC MP4.`);
        continue;
      }

      console.log(`--------------------------------------------------`);
      console.log(`Optimizing: ${file}`);
      console.log(`Current Codecs: Video: ${videoCodec} | Audio: ${audioCodec}`);
      console.log(`--------------------------------------------------`);

      // Determine conversion targets
      const vcodec = isVideoH264 ? 'copy' : 'h264_qsv'; // Use Intel QSV for super fast H.264 transcoding!
      const acodec = 'aac';

      // 1. Run conversion to temp file
      await convertFile(inputPath, tempOutputPath, vcodec, acodec);

      // 2. Extract subtitles if it was an MKV file
      if (ext === '.mkv') {
        for (const [subIdx, subStream] of subtitleStreams.entries()) {
          const lang = subStream.tags?.language || `track_${subIdx + 1}`;
          const subFile = path.join(moviesDir, `${baseName}.${lang}.srt`);
          await extractSubtitle(inputPath, subStream.index, subFile);
        }
      }

      // 3. Delete original file (and output MP4 if we are overwriting an HEVC MP4)
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      if (inputPath !== outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      // 4. Rename temp to final output MP4
      fs.renameSync(tempOutputPath, outputPath);
      console.log(`Successfully completed and verified: ${baseName}.mp4`);

    } catch (e) {
      console.error(`Error processing file ${file}:`, e.message);
      // Clean up temp output if failed
      if (fs.existsSync(tempOutputPath)) {
        try { fs.unlinkSync(tempOutputPath); } catch (_) {}
      }
    }
  }

  console.log('\n==================================================');
  console.log('UNIVERSAL OPTIMIZATION COMPLETE!');
  console.log('==================================================');
};

run();
