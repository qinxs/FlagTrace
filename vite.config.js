/**
 * 使用构建工具的目的
 * 1 同一处代码 方便维护
 * 2 build多个 方便加载测试和管理manifest等差异化文件
 * 3 @TODO 扩展热重载 暂未实现
 */
import { defineConfig } from "vite";
// 垃圾插件 不支持ignore structured也无效！
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readFileSync } from 'fs';
import path from 'path';

const target = process.env.TARGET_BROWSER || "chrome",
      isFF = target !== "chrome",
      suffix = isFF ? "_firefox" : "";

// 读取 package.json 版本号
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const appVersion = packageJson.version;

export default defineConfig({
  build: { outDir: `dist/${target}/` },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: `src/manifest${suffix}.json`, 
          dest: '', 
          rename: "manifest.json",
          // 修改版本号
          transform: (content) => {
            const manifest = JSON.parse(content);
            manifest.version = appVersion;
            return JSON.stringify(manifest, null, 2);
          },
        },
        {
          src: [
            "src/*",
            "!src/manifest*.json",
            "!src/icons/**",
            isFF ? "!src/worker.js" : "!src/donothing.js",
          ],
          dest: '',
        },
        {
          src: [
            "src/icons/*",
            "!src/icons/flags*/**", //firefox和chrome 国旗尺寸不一样
          ],
          dest: `icons/`,
        },
        {
          src: [
            `src/icons/flags${suffix}/**`,
          ],
          dest: `icons/flags`,
        }
      ]
    })
  ]
});
