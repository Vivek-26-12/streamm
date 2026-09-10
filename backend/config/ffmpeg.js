import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import dotenv from 'dotenv';

dotenv.config();

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
const ffprobePath = process.env.FFPROBE_PATH || ffprobeInstaller.path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export default ffmpeg;
