'use strict';

let initGeoIPPromise = null;
let geoipInstance = null;

const initGeoIP = async () => {
  try {
    // 文件实际路径
    const res = await fetch('db/GeoLite2-Country.mmdb');
    const ab = await res.arrayBuffer();
    await prepareGeoIPFile('/data/geoip.mmdb', ab); // 内存中虚拟路径
    
    const jgeoip = require('jgeoip');
    const instance = new jgeoip('/data/geoip.mmdb');
    geoipInstance = instance;
    return instance;
  } catch (err) {
    geoipInstance = null;
    initGeoIPPromise = null;
    throw err;
  }
}

const ensureGeoIPReady = async () => {
  if (!initGeoIPPromise) {
    initGeoIPPromise = initGeoIP();
  }
  return initGeoIPPromise;
}

// 统一封装方法调用
const createGeoIPMethod = (methodName) => {
  return async (...args) => {
    try {
      await ensureGeoIPReady();
      return geoipInstance[methodName](...args);
    } catch (err) {
      throw err;
    }
  }
}

// ensureGeoIPReady();
self.IP2Country = createGeoIPMethod('getRecord');
// 重新加载db 并保持构建时间
self.getGeoIPBuildTime = async () => {
  await ensureGeoIPReady();
  return geoipInstance.metadata.build_epoch;
}
self.clearGeoDB = () => {
  // 清理GeoDB 下次重新加载
  geoipInstance = null;
  initGeoIPPromise = null;
}