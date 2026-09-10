import ffmpeg from '../config/ffmpeg.js';
import fs from 'fs';

const filePath = `D:\\Songs\\Pendrive\\movies\\Streamm\\backend\\movies\\Obsession (2026) 1080p 10bit WEB-DL x265 HEVC Dual Audio Hindi English ESubs - MoviesMod.At.mkv`;
const seekSeconds = 600; // seek to 10 minutes

console.log('--- STARTING SEEK TRANSCODE DIAGNOSTIC ---');
console.log('Seeking to:', seekSeconds, 'seconds');

const outStream = fs.createWriteStream('./test_seek_output.mp4');

const cmd = ffmpeg();

cmd.input(filePath);

// Fast seeking parameter applied to input
if (seekSeconds > 0) {
  cmd.inputOption('-ss', seekSeconds.toString());
}

cmd.videoCodec('h264_qsv')
  .outputOptions([
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-max_muxing_queue_size', '9999'
  ])
  .audioCodec('aac')
  .audioBitrate('192k')
  .audioChannels(2)
  .format('mp4')
  .outputOptions([
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof'
  ])
  .duration(5)
  .on('start', (cmdline) => {
    console.log('\nFFmpeg Command executed:\n', cmdline, '\n');
  })
  .on('stderr', (line) => {
    console.log('[FFmpeg Stderr]', line);
  })
  .on('error', (err) => {
    console.error('\nSeek transcode failed with error:', err.message);
    process.exit(1);
  })
  .on('end', () => {
    console.log('\nSeek transcode finished successfully!');
    fs.unlinkSync('./test_seek_output.mp4');
    process.exit(0);
  });

cmd.pipe(outStream);
