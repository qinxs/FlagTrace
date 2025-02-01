/* 浏览器环境 Node.js 核心模块 Polyfill */
(function(global) {
  'use strict';

  // ==================== 模块系统 Polyfill ====================
  const moduleMap = new Map();
  
  global.module = { exports: {} };
  global.require = function(name) {
    if (moduleMap.has(name)) return moduleMap.get(name).exports;
    
    switch(name) {
      case 'fs':
        return moduleMap.set(name, {
          exports: {
            accessSync: () => true,
            readFileSync: path => {
              const data = moduleMap.get('fs:data')?.[path];
              if (!data) throw new Error(`ENOENT: no such file '${path}'`);
              return Buffer.from(data);
            }
          }
        }).get(name).exports;

      case 'jgeoip':
        return module.exports;

      default:
        throw new Error(`Cannot find module '${name}'`);
    }
  };

  // ==================== Buffer Polyfill ====================
  class BrowserBuffer extends Uint8Array {
    static from(source, encoding) {
      if (encoding === 'hex') {
        return new this(source.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
      }
      return new this(source);
    }

    readUInt8(offset) {
      return new DataView(this.buffer).getUint8(offset);
    }

    readUInt16BE(offset) {
      return new DataView(this.buffer).getUint16(offset, false);
    }

    readUInt32BE(offset) {
      return new DataView(this.buffer).getUint32(offset, false);
    }

    toString(encoding = 'utf-8', start, end) {
      return new TextDecoder(encoding).decode(this.subarray(start, end));
    }
  }

  global.Buffer = BrowserBuffer;

  // ==================== 文件预加载接口 ====================
  global.prepareGeoIPFile = function(path, arrayBuffer) {
    const fsData = moduleMap.get('fs:data') || {};
    fsData[path] = arrayBuffer; // 直接存储 ArrayBuffer
    moduleMap.set('fs:data', fsData);
  };
})(self || window);
