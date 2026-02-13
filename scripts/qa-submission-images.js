const fs = require('fs');
const path = require('path');

const SUBMISSION_DIR = path.resolve(__dirname, '..', 'submission');

const REQUIRED = [
  { file: 'thumbnail-square-1000x1000.png', width: 1000, height: 1000, type: 'thumbnail' },
  { file: 'thumbnail-landscape-1932x828.png', width: 1932, height: 828, type: 'thumbnail' },
  { file: 'screenshot-vertical-01-636x1048.png', width: 636, height: 1048, type: 'screenshot-vertical' },
  { file: 'screenshot-vertical-02-636x1048.png', width: 636, height: 1048, type: 'screenshot-vertical' },
  { file: 'screenshot-vertical-03-636x1048.png', width: 636, height: 1048, type: 'screenshot-vertical' },
  { file: 'screenshot-horizontal-01-1504x741.png', width: 1504, height: 741, type: 'screenshot-horizontal' },
];

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`Not a PNG: ${filePath}`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function main() {
  if (!fs.existsSync(SUBMISSION_DIR)) {
    console.error(`Missing directory: ${SUBMISSION_DIR}`);
    process.exit(1);
  }

  let failed = false;

  for (const item of REQUIRED) {
    const filePath = path.join(SUBMISSION_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.error(`MISS ${item.file}`);
      failed = true;
      continue;
    }

    try {
      const size = readPngSize(filePath);
      if (size.width !== item.width || size.height !== item.height) {
        console.error(`SIZE_FAIL ${item.file} expected=${item.width}x${item.height} actual=${size.width}x${size.height}`);
        failed = true;
      } else {
        console.log(`OK ${item.file} ${size.width}x${size.height}`);
      }
    } catch (error) {
      console.error(`READ_FAIL ${item.file}: ${error.message}`);
      failed = true;
    }
  }

  const vCount = REQUIRED.filter(item => item.type === 'screenshot-vertical').length;
  const hCount = REQUIRED.filter(item => item.type === 'screenshot-horizontal').length;
  if (vCount < 3 || hCount < 1) {
    console.error(`COUNT_FAIL vertical=${vCount} horizontal=${hCount}`);
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }
}

main();
