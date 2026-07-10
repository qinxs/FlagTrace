'use strict';

// 尺寸信息
const sizeInfo = {
  $useOriginalSize: document.getElementById('useOriginalSize'),
  $widthInput: document.getElementById('widthInput'),
  $heightInput: document.getElementById('heightInput'),
  $sizePreset: document.getElementById('sizePreset'),
  init() {
    this.restore();
    this.events();
    this.$useOriginalSize.dispatchEvent(new Event('change'));
  },
  getConfig() {
    return {
      useOriginal: this.$useOriginalSize.checked,
      width: parseInt(this.$widthInput.value) || 32,
      height: parseInt(this.$heightInput.value) || 32,
      preset: this.$sizePreset.value,
    };
  },
  save() {
    localStorage.setItem('sizeInfoConfig', JSON.stringify(this.getConfig()));
  },
  restore() {
    const raw = localStorage.getItem('sizeInfoConfig');
    if (!raw) return;
    try {
      const c = JSON.parse(raw);
      this.$useOriginalSize.checked = c.useOriginal;
      this.$widthInput.value = c.width;
      this.$heightInput.value = c.height;
      this.$sizePreset.value = c.preset;
    } catch (e) {}
  },
  events() {
    this.$useOriginalSize.addEventListener('change', () => {
      this.$widthInput.disabled = this.$useOriginalSize.checked;
      this.$heightInput.disabled = this.$useOriginalSize.checked;
      this.$sizePreset.disabled = this.$useOriginalSize.checked;
      this.save();
    });
    this.$widthInput.addEventListener('input', () => this.save());
    this.$heightInput.addEventListener('input', () => this.save());
    this.$sizePreset.addEventListener('change', () => {
      this.$widthInput.value = this.$sizePreset.value;
      this.$heightInput.value = this.$sizePreset.value;
      this.save();
    });
  },
}

/**
 * 生成下载文件名（将 .svg 替换为 .png）
 * @param {string} originalName
 * @returns {string}
 */
const toPngFileName = (originalName) => originalName.replace(/\.svg$/i, '.png');

/**
 * 从 SVG 文本中解析原始宽高（优先 width/height，其次 viewBox）
 * @param {string} svgText
 * @returns {{ width: number, height: number }}
 */
const getSvgOriginalSize = (svgText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) throw new Error('无法解析 SVG 结构');

  let width = NaN, height = NaN;

  // 尝试 width / height 属性
  const rawW = svgEl.getAttribute('width');
  const rawH = svgEl.getAttribute('height');
  if (rawW && rawH) {
    width = parseFloat(rawW);
    height = parseFloat(rawH);
  }

  // 若缺失则从 viewBox 获取
  if ((!width || !height) && svgEl.hasAttribute('viewBox')) {
    const parts = svgEl.getAttribute('viewBox').trim().split(/\s+/).map(Number);
    if (parts.length === 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }

  if (!width || !height || isNaN(width) || isNaN(height)) {
    throw new Error('SVG 中未找到有效的宽高或 viewBox');
  }

  return { width, height };
}

/**
 * 将 SVG 字符串渲染到 Canvas 上，返回 PNG Blob
 * @param {string} svgText
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Blob>}
 */
const renderSvgToPng = (svgText, width, height) =>
  new Promise(async (resolve, reject) => {
    try {
      // 改为 Base64 编码
      const base64 = btoa(unescape(encodeURIComponent(svgText)));
      const dataUri = `data:image/svg+xml;base64,${base64}`;

      const img = await new Promise((res, rej) => {
        const image = new Image();
        image.crossOrigin = 'anonymous'; // 可选，增强安全性
        image.onload = () => res(image);
        image.onerror = () => rej(new Error('SVG 渲染失败'));
        image.src = dataUri;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error('PNG 导出失败'));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });

/**
 * 处理单个文件，返回 { fileName, blob } 或抛出错误
 * @param {File} file
 * @param {object} sizeConfig
 * @returns {Promise<{fileName: string, blob: Blob}>}
 */
const processFile = async (file, sizeConfig) => {
  let { width, height, useOriginal } = sizeConfig;
  const svgText = await file.text();

  if (useOriginal) {
    ({ width, height } = getSvgOriginalSize(svgText));
  }

  const blob = await renderSvgToPng(svgText, width, height);
  return { fileName: toPngFileName(file.name), blob };
};

/**
 * 下载一个 Blob 对象为文件
 * @param {Blob} blob
 * @param {string} fileName
 */
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 打包下载
const zipBlobFiles = async (files) => {
  const zip = new JSZip();
  for (const item of files) {
    zip.file(item.name, item.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
};

/**
 * 主转换控制器，接收文件列表和配置，返回统计结果
 * @param {File[]} files
 * @param {object} sizeConfig
 * @returns {Promise<{success: number, fail: number, results: Array<{fileName: string, blob: Blob}|Error>}>}
 */
const convertAll = async (files, sizeConfig) => {
  const tasks = Array.from(files).map((file) =>
    processFile(file, sizeConfig).then(
      (result) => ({ status: 'fulfilled', value: result }),
      (error) => ({ status: 'rejected', reason: error, fileName: file.name })
    )
  );

  const settled = await Promise.all(tasks);
  const results = settled.map((item) => {
    if (item.status === 'fulfilled') return item.value;
    else return new Error(`❌ ${item.fileName}: ${item.reason.message}`);
  });

  const success = results.filter((r) => !(r instanceof Error)).length;
  const fail = results.filter((r) => r instanceof Error).length;

  return { success, fail, results };
};

// ===================== UI 绑定 =====================

sizeInfo.init();
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('filePicker');
  const fileCount = document.getElementById('fileCount');
  const convertBtn = document.getElementById('convertBtn');
  const log = document.getElementById('log');

  // ---------- 统一文件状态管理 ----------
  // currentFiles 可以是 FileList 或 File[]，始终代表当前待转换的文件集合
  let currentFiles = null;

  /**
   * 更新文件计数显示
   * @param {number} count
   */
  function updateFileCount(count) {
    fileCount.textContent = count ? `已选 ${count} 个文件` : '未选择';
  }

  // 原有的文件选择器 change 事件 —— 同步更新 currentFiles
  fileInput.addEventListener('change', () => {
    currentFiles = fileInput.files;
    updateFileCount(currentFiles.length);
  });

  // ---------- 拖拽支持（整个 body） ----------
  let dragCounter = 0; // 防抖计数器，避免子元素 dragleave 误触

  document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    document.body.classList.add('dragging');
  });

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 保持 dragging 状态
    document.body.classList.add('dragging');
  });

  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      document.body.classList.remove('dragging');
    }
  });

  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    document.body.classList.remove('dragging');

    const rawFiles = Array.from(e.dataTransfer.files);
    if (!rawFiles.length) return;

    // 过滤出 SVG 文件
    const svgFiles = rawFiles.filter((f) =>
      f.name.toLowerCase().endsWith('.svg')
    );
    const filteredCount = rawFiles.length - svgFiles.length;

    if (svgFiles.length === 0) {
      log.textContent = '⚠️ 没有检测到 SVG 文件，请拖入 .svg 格式的文件。\n';
      return;
    }

    // 如果有非 SVG 文件被过滤，给出提示
    let msg = '';
    if (filteredCount > 0) {
      msg = `⚠️ 已自动过滤 ${filteredCount} 个非 SVG 文件\n`;
    }

    // 使用 DataTransfer 构建 FileList，保持类型一致
    const dt = new DataTransfer();
    svgFiles.forEach((f) => dt.items.add(f));
    currentFiles = dt.files;

    updateFileCount(currentFiles.length);
    log.textContent =
      msg +
      `✅ 已通过拖拽添加 ${currentFiles.length} 个 SVG 文件，点击「开始转换」按钮进行转换。\n`;
  });

  // ---------- 转换按钮逻辑（改用 currentFiles） ----------
  convertBtn.addEventListener('click', async () => {
    // 优先使用 currentFiles（支持拖拽和文件选择器两种来源）
    const files = currentFiles;
    if (!files || !files.length) {
      alert('请先选择或拖拽 SVG 文件');
      return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = '⏳ 正在转换...';
    log.textContent = '';

    const sizeConfig = sizeInfo.getConfig();

    try {
      const { success, fail, results } = await convertAll(files, sizeConfig);

      // 收集成功的 PNG 文件用于下载
      const pngFiles = [];

      results.forEach((result) => {
        if (result instanceof Error) {
          log.textContent += `${result.message}\n`;
        } else {
          const { fileName, blob } = result;
          pngFiles.push({ name: fileName, blob });
          log.textContent += `✅ ${fileName}\n`;
        }
      });

      // 下载：单文件直接下载，多文件打包 zip
      if (pngFiles.length === 1) {
        downloadBlob(pngFiles[0].blob, pngFiles[0].name);
      } else if (pngFiles.length > 1) {
        const zipBlob = await zipBlobFiles(pngFiles);
        downloadBlob(zipBlob, 'svg2png.zip');
      }

      log.textContent += `\n🎉 完成！成功 ${success} 个，失败 ${fail} 个。`;
    } catch (err) {
      log.textContent += `\n❌ 意外错误：${err.message}`;
      throw err;
    } finally {
      convertBtn.textContent = '▶ 开始转换';
      convertBtn.disabled = false;
    }
  });
});
