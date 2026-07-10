// update-geoip.mjs
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { getRootDir } from './utils.mjs';

const ROOT = getRootDir(import.meta.url);
const geoipUpdatePath = path.join(ROOT, 'tools/geoipupdate.exe');
const mmdbinspectPath = path.join(ROOT, 'tools/mmdbinspect/mmdbinspect.exe');

const outDir = path.join(ROOT, 'src/db');
const confPath = path.join(ROOT, 'tools/GeoIP.conf');
const metaPath = path.join(ROOT, 'amo-metadata.json');

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function getGeoIPBuildTime() {
  const mmdbPath = path.join(outDir, 'GeoLite2-Country.mmdb');
  const output = execSync(
    `${mmdbinspectPath} -db "${mmdbPath}" -jsonl -include-build-time 8.8.8.8`,
    { encoding: 'utf-8' }
  ).trim();

  // -jsonl 每 IP 一行 JSON，取第一行 parse
  const line = output.split('\n')[0];
  const parsed = JSON.parse(line);
  // parsed.build_time => "2026-07-08T18:22:00Z"
  const date = new Date(parsed.build_time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function updateAmoMetadata(dateStr) {
  // 读取现有的 amo-metadata.json
  const metaRaw = await fs.readFile(metaPath, 'utf-8');
  const meta = JSON.parse(metaRaw);

  // 更新 release_notes 中的日期
  meta.version.release_notes['en-US'] = `Update IP library to ${dateStr}`;
  meta.version.release_notes['zh-CN'] = `更新 IP 库至 ${dateStr}`;

  // 写回文件（保留原格式）
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`已更新 amo-metadata.json 中的日期为 ${dateStr}`);
}

async function main() {
  try {
    await fs.mkdir(outDir, { recursive: true });
    
    console.log('更新GeoLite2 IP库...');
    execSync(`"${geoipUpdatePath}" -d "${outDir}" -f "${confPath}"`, { stdio: 'inherit' });

    let dateStr = getGeoIPBuildTime();
    // console.log(dateStr);
    await updateAmoMetadata(dateStr);
    
    console.log('更新完成！');
  } catch (err) {
    console.error(`执行失败: ${err.message}`);
    process.exit(1);
  }
}

main();