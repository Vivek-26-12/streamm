import ffmpeg from '../config/ffmpeg.js';
import fs from 'fs';

const filePath = `D:\\Songs\\Pendrive\\movies\\Streamm\\backend\\movies\\CockTail-2.2026.1080p.HDTC.Hindi-Line.HC-ESub.x264-MoviesLeech.mkv`;
const seekSeconds = 869;

console.log('--- STARTING COCKTAIL TEST TRANSCODE ---');
console.log('File path:', filePath);
console.log('Seeking to:', seekSeconds);

const outStream = fs.createWriteStream('./test_cocktail_output.mp4');

const cmd = ffmpeg();
cmd.input(filePath);

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
  .duration(5) // test only 5 seconds
  .on('start', (cmdline) => {
    console.log('\nFFmpeg Executed Command:\n', cmdline, '\n');
  })
  .on('stderr', (line) => {
    console.log('[FFmpeg Stderr]', line);
  })
  .on('error', (err) => {
    console.error('\nTranscode test failed with error:', err.message);
    process.exit(1);
  })
  .on('end', () => {
    console.log('\nTranscode test finished successfully!');
    fs.unlinkSync('./test_cocktail_output.mp4');
    process.exit(0);
  });

cmd.pipe(outStream);
