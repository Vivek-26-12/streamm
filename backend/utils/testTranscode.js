import ffmpeg from '../config/ffmpeg.js';
import fs from 'fs';

const filePath = `D:\\Songs\\Pendrive\\movies\\Streamm\\backend\\movies\\Obsession (2026) 1080p 10bit WEB-DL x265 HEVC Dual Audio Hindi English ESubs - MoviesMod.At.mkv`;

console.log('--- STARTING FFMEPG DIAGNOSTIC TRANSCODE ---');
console.log('File path:', filePath);

const outStream = fs.createWriteStream('./test_output.mp4');

const cmd = ffmpeg()
  .input(filePath)
  .videoCodec('h264_qsv')
  .outputOptions([
    '-preset', 'fast',
    '-zerolatency', '1',
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
    // Print all ffmpeg diagnostic logging
    console.log('[FFmpeg Stderr]', line);
  })
  .on('error', (err) => {
    console.error('\nTranscode test failed with error:', err.message);
    process.exit(1);
  })
  .on('end', () => {
    console.log('\nTranscode test finished successfully! File created at ./test_output.mp4');
    fs.unlinkSync('./test_output.mp4'); // clean up
    process.exit(0);
  });

cmd.pipe(outStream);
