import archiver from 'archiver';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { 
  getRootDir,
  formatBytes
} from './utils.mjs';
import { fileURLToPath } from 'url';

// 压缩打包函数
async function createArchive(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { 
      zlib: { level: 9 } // 最高压缩级别
    });

    output.on('close', () => {
      console.log(`[${path.basename(outputPath)}] 已生成，大小: ${formatBytes(archive.pointer())}`);
      resolve();
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('文件警告:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(inputPath, false);
    archive.finalize();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const browsers = [];
  if (args.includes('--chrome')) browsers.push('chrome');
  if (args.includes('--firefox')) browsers.push('firefox');
  if (browsers.length === 0) {
    console.log('❌ 请输入有效的浏览器参数，如 --chrome');
    return;
  };

  // 获取路径
  const rootDir = getRootDir(import.meta.url);
  const basePath = path.join(rootDir, 'dist');

  try {
    for (const browser of browsers) {
      await createArchive(
        path.join(basePath, browser),
        path.join(basePath, `${browser}.zip`)
      );
    }
    
    console.log('✅ 打包完成，压缩包已生成在 dist 目录');
  } catch (err) {
    console.error('❌ 打包失败:', err);
    process.exit(1);
  }
}

await main();