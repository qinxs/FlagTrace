#!/usr/bin/env python3
#
#  给 FlagTrace 生成国旗图标（包括 chrome 和 firefox）
#  

import os
import sys
import shutil
from pathlib import Path

# ============= 全局配置 =============
SOURCE_DIR = "./4x3"

# chrome图标比列: 画布 16*16, 内容 14*13
chrome_config = {
    "target_dir": "./4x3 - chrome",
    "old_text": 'viewBox="0 0 640 480"',
    "new_text": 'viewBox="0 -80 640 640" style="transform: scale(calc(14 / 16), calc(13 / 12))"'
}

# firefox图标比列: 画布 16*16, 内容 16*14
firefox_config = {
    "target_dir": "./4x3 - firefox",
    "old_text": 'viewBox="0 0 640 480"',
    "new_text": 'viewBox="0 -80 640 640" style="transform: scaleY(calc(14 / 12))"'
}
# ====================================

def _replace_and_save(src_path, dst_path, old_str, new_str):
    """读取源文件，替换内容，写入目标文件"""
    try:
        with open(src_path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = content.replace(old_str, new_str)
        with open(dst_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"\r已保存: {dst_path}\033[K", end="", flush=True)
    except Exception as e:
        print(f"\n处理文件 {src_path} 时出错: {e}")

def batch_replace_with_config(config):
    print()

    """根据配置对象执行批量替换（使用全局 SOURCE_DIR）"""
    if not os.path.isdir(SOURCE_DIR):
        print(f"错误：源目录 '{SOURCE_DIR}' 不存在")
        return

    target_dir = config["target_dir"]

    if os.path.exists(target_dir):
        print(f"正在删除旧目录: {target_dir}")
        shutil.rmtree(target_dir)
    os.makedirs(target_dir, exist_ok=True)
    count = 0

    for file in os.listdir(SOURCE_DIR):
        if file.lower().endswith('.svg'):
            src_path = os.path.join(SOURCE_DIR, file)
            p = Path(file)
            new_filename = p.stem.upper() + p.suffix
            dst_path = str(Path(target_dir) / new_filename)
            _replace_and_save(src_path, dst_path, config["old_text"], config["new_text"])
            count += 1

    print(f"\n处理完成，共替换并保存 {count} 个文件到 '{target_dir}'")

if __name__ == "__main__":
    args = sys.argv[1:] # 获取命令行参数（去掉脚本名）
    has_chrome = any("chrome" in arg.lower() for arg in args)
    has_firefox = any("firefox" in arg.lower() for arg in args)

    # 如果都没有指定，则同时生成两者
    if not has_chrome and not has_firefox:
        has_chrome = True
        has_firefox = True

    if has_chrome:
        batch_replace_with_config(chrome_config)

    if has_firefox:
        batch_replace_with_config(firefox_config)
