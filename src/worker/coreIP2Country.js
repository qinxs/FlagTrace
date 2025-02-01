'use strict';

let initPromise = null;

const initializeGeoIP = async () => {
  // 文件实际路径
  const ab = await (await fetch('db/GeoLite2-Country.mmdb')).arrayBuffer();
  await prepareGeoIPFile('/data/geoip.mmdb', ab); // 内存中虚拟路径
  
  const jgeoip = require('jgeoip');
  const instance = new jgeoip('/data/geoip.mmdb');
  
  // 返回 getRecord 方法的绑定版本
  return instance.getRecord.bind(instance);
}

self.IP2Country = async (ip) => {
  if (!initPromise) {
    initPromise = initializeGeoIP().catch(err => {
      // 初始化失败时清理状态
      initPromise = null;
      throw err;
    });
  }
  
  // 确保获取到的实例方法被正确调用
  const getRecordFunc = await initPromise;
  return getRecordFunc(ip);
};