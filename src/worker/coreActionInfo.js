'use strict';
/**
 * 以下3种方式获得ip：
 * 1 onResponseStarted事件：代价小
 *   不能获取扩展安装或者重新开启前的标签页ip
 *   不能获取启动浏览器时的标签页ip
 * 2 chrome.dns：环回地址不会缓存到dns，开vpn时无效
 * 3 webRequest后台重新请求：1的补充，每个tab多一次请求
 */

const tabInfoMap = new Map();
chrome.tabs.onCreated.addListener(tab => tabInfoMap.set(tab.id, {}));
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => tabInfoMap.delete(tabId));

const ensureSettingsLoaded = () => settings ? Promise.resolve() : loadSettings();
const queryByDNS = (hostname) =>
  new Promise((resolve, reject) => {
    chrome.dns.resolve(hostname).then((result) => {
      let address = result.address || result.addresses;
      if (Array.isArray(address)) address = address[0];
      resolve(address);
    }, reject);
  });


// 监控标签页 获取IP
// onHeadersReceived onResponseStarted
// @TODO 更新图标有时候会失败
chrome.webRequest.onResponseStarted.addListener((details) => {
  if (details.type !== 'main_frame' && !_isGetIPRequest(details)) return;
  DEBUG && console.log('[onResponseStarted]: ', details);

  let  { tabId, ip } = details;
  let url = new URL(details.url);
  let hostname = url.hostname;
  // 后台模拟请求 existing.js
  if (tabId < 0) {
    let urlParams = url.searchParams;
    tabId = Number(urlParams.get(tabIdParamName));
  }

  checkIPAndFilter(tabId, ip, hostname)
    .then(result => {
      if (result.isFiltered) return;
      updateTabInfo(tabId, hostname, ip, result.ipFromDNS);
    });

  let tabInfo = tabInfoMap.get(tabId);
  tabInfo[hostname] = ip;
}, {
  urls: ['<all_urls>'],
});

// 无请求页面（如chrome-extension://）
chrome.webNavigation.onCommitted.addListener((details) => {
  if (!details.url || details.frameId !== 0) return;
  DEBUG && console.log('[onCommitted]: ', details);

  let { tabId, url } = details;
  url = url.replace(/^view-source:/, '');
  let { isFiltered, hostname } = checkUrlAndFilter(tabId, url);
  if (isFiltered) return;

  // 处理 前进、后退 bfcache
  if (!details.transitionQualifiers.includes('forward_back')) return;
  let tabInfo = tabInfoMap.get(tabId);

  let ip = tabInfo[hostname];
  checkIPAndFilter(tabId, ip, hostname)
    .then(result => {
      if (result.isFiltered) return;
      updateTabInfo(tabId, hostname, ip, result.ipFromDNS);
    });
});

isFF && chrome.webRequest.onErrorOccurred.addListener((details) => {
  DEBUG && console.log('[onErrorOccurred]: ', details);
  
  let tabId = details.tabId;
  updateActionDetails({
    tabId,
    path: 'icons/32.png',
  });
}, {
  urls: ['<all_urls>'],
  types: ['main_frame'],
});

const protocolMap = {
  resource: L('internalPage'),
  extension: L('extensionPage'),
  file: L('localFile'),
  data: 'Data URL',
}
function checkUrlAndFilter(tabId, url) {
  let isFiltered = false, path, title;
  let { protocol, hostname } = new URL(url);
  protocol = protocol.slice(0, -1);

  if (protocol.startsWith('http')) {
    // 直接交给后续处理
  } else if (protocol.includes('extension')) {
    isFiltered = true;
    title = `${protocolMap.extension}`;
    path = 'icons/special/resource.png';
  } else if (['resource', 'file', 'data'].includes(protocol)) {
    isFiltered = true;
    title = `${protocolMap[protocol]}`;
    path = `icons/special/${protocol}.png`;
  } else {
    isFiltered = true;
    path = 'icons/32.png';
  }

  if (isFiltered) {
    updateActionDetails({ tabId, title, path });
  }

  return { isFiltered, hostname };
}

function checkIPAndFilter(tabId, ip, hostname) {
  return new Promise((resolve, reject) => {
    let isFiltered = false;
    let path, location, ipFromDNS;
    let type, ipClass;

    // 官方页面如 https://developer.mozilla.org/zh-CN/
    // 后台请求 返回ip为null
    if (!ip) {
      isFiltered = true;
      type = 'public';
      location = L('unknown');
      path = `icons/32.png`;
      finalize();
      return;
    }
    
    ({ type, ipClass } = utils.IPClassify.query(ip));

    function handleLocal() {
      isFiltered = true;
      location = L('localComputer');
      path = `icons/special/proxy.png`;
      finalize();
    }
    function finalize() {
      if (isFiltered) {
        let titleInfo = titleTemplate(type, { 
          location, hostname, ipClass, ip, ipFromDNS,
        });
        updateActionDetails({ 
          tabId, 
          title: titleInfo,
          path,
        });
      }
      resolve({ isFiltered, type, ipFromDNS });
    }

    if (type === 'public') {
      resolve({ isFiltered, type });
    } else if (type === 'private') {
      isFiltered = true;
      location = L('LAN');
      path = `icons/special/privateip.png`;
      finalize();
    } else if (type === 'loopback') {
      // DEBUG && console.log(type, ip, hostname);
      ensureSettingsLoaded().then(() => {
        if (!settings.useDNS) {
          handleLocal();
          return resolve();
        }

        queryByDNS(hostname)
          .then((address) => {
            ipFromDNS = address;
            if (utils.IPClassify.isLoopbackIP(ipFromDNS)) {
              ipFromDNS = undefined;
              handleLocal();
            } else {
              finalize();
            }
          })
          .catch(handleLocal);
        });
    }
  });
}

// @TODO 支持所有主流语言 而不仅仅是IP库
const dbSupportLang = ['de', 'en', 'es', 'fr', 'ja', 'pt-BR', 'ru', 'zh-CN'];

const isoCode2Lang = (iso_code) => {
  return dbSupportLang.includes(uiLang) ?  uiLang : 'en';
}

function updateTabInfo(tabId, hostname, ip, ipFromDNS) {
  // DEBUG && console.trace(tabId, ipFromDNS || ip);
  if (!tabId || !hostname || !ip) return;

  IP2Country(ipFromDNS || ip).then((record) => {
    let country = record.country || record.registered_country,
        code = country.iso_code,
        countryName = country['names'][isoCode2Lang(code)];
    
    let titleInfo = titleTemplate('public', {
      location: countryName,
      hostname,
      ip,
      ipFromDNS,
    });
    updateActionDetails({ 
      tabId,
      title: titleInfo,
      path: `icons/flags/${code}.png`,
    });
  });
}

function titleTemplate(type, data) {
  let titleInfo;
  let { location, hostname, ip = null, ipClass, ipFromDNS } = data;
  switch(type) {
    case 'private':
      if ('ABC'.includes(ipClass)) ipClass += L('class');
      titleInfo = `
${L('ipClass')}:  ${ipClass}\n
${L('ipAdress')}:  ${ip}
${L('location')}:  ${location}
`;
      break;
    case 'public':
    case 'loopback':
      titleInfo = `
${L('domain')}:  ${hostname}\n
${ipFromDNS ? `${L('ipAdressFromDNS')}:  ${ipFromDNS}` : `${L('ipAdress')}:  ${ip}`}
${L('location')}:  ${location}
`;
      break;
  }

  return titleInfo.trimStart();
}

function updateActionDetails(details) {
  DEBUG && console.log('[updateAction]: ', details);

  let { tabId, path, title } = details;
  let tabInfo = tabInfoMap.get(tabId);
  if (!tabInfo) return;

  let iconPromise = Promise.resolve(
    path && chrome.action.setIcon({ tabId, path })
  );

  let titlePromise = iconPromise.then(() => {
    return title && chrome.action.setTitle({ tabId, title });
  });

  titlePromise.then(() => {
    chrome.action.show && chrome.action.show(tabId);
  });
}