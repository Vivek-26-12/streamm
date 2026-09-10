import { detectEncoders, getBestVideoEncoder } from '../services/transcode/transcodeService.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n==================================================');
console.log('STARTING DATABASE-FREE INTEGRATION TEST...');
console.log('==================================================\n');

async function runTest() {
  try {
    // 1. Check Env parameters
    console.log('[1/3] Checking environment configurations...');
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    console.log(`      Administrator Password parsed: "${'*'.repeat(adminPass.length)}"`);

    // 2. Check FFmpeg binary paths
    console.log('[2/3] Probing FFmpeg / FFprobe executable outputs...');
    const encoders = await detectEncoders();
    console.log(`      Found ${encoders.length} total encoders.`);

    // 3. Check Hardware Accel compatibility
    console.log('[3/3] Analyzing GPU Hardware Acceleration...');
    const bestEncoder = getBestVideoEncoder();
    console.log(`      Best encoder selected: "${bestEncoder}"`);
    if (bestEncoder.includes('nvenc')) {
      console.log('      Status: NVIDIA NVENC Hardware acceleration active!');
    } else if (bestEncoder.includes('qsv')) {
      console.log('      Status: Intel QSV Hardware acceleration active!');
    } else if (bestEncoder.includes('amf')) {
      console.log('      Status: AMD AMF Hardware acceleration active!');
    } else {
      console.log('      Status: Hardware acceleration inactive. Falling back to CPU.');
    }

    console.log('\n==================================================');
    console.log('DATABASE-FREE INTEGRATION TEST PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n==================================================');
    console.error('INTEGRATION TEST FAILED!');
    console.error('Reason:', error.message);
    console.error('==================================================\n');
    process.exit(1);
  }
}

runTest();
