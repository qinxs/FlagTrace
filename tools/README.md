## 生成国旗图标

> 国旗图标来源: [ lipis/flag-icons ](https://github.com/lipis/flag-icons)
>
> 使用 4x3 格式（比例比 1x1 好）  
chrome 图标比列: 画布 16*16, 内容 14*13  
firefox 图标比列: 画布 16*16, 内容 16*14  

1. 调整国旗图标尺寸（svg）

使用 py 脚本 `buildFlagTraceIcons.py`

*如果没有 python 环境 也可手动调整*

> 用 sublime 打开 svg 目录，然后批量替换，文件 -> 全部保存
>
> FIrefox: viewBox="0 -80 640 640" style="transform: scaleY(calc(14 / 12))"
>
> Chrome: viewBox="0 -80 640 640" style="transform: scale(calc(14 / 16), calc(13 / 12))"

2. 国旗图标 svg 转为 png  
    chrome 系浏览器 打开 `svg2png/index.html`，直接转换，尺寸为 32


## GeoIP 库更新

通过 `pnpm upgeo` 命令更新（使用前 配置好 GeoIP.conf）  
> 依赖程序: `geoipupdate.exe`, `mmdbinspect.exe`


## 设置图标说明

部分取自 Flagfox扩展
