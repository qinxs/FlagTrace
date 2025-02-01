// utils.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const getFilename = (metaUrl) => fileURLToPath(metaUrl);
const getDirname = (metaUrl) => path.dirname(getFilename(metaUrl));

// 获取项目根目录
export const getRootDir = (metaUrl) => path.join(getDirname(metaUrl), '..');

// 智能文件大小格式化
export const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
};