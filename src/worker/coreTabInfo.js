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

const iconPath = {
  default: 'icons/special/global.png',
  error: 'icons/special/error.png',
}

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
const watchIPEvent = isFF ? 'onHeadersReceived' : 'onResponseStarted';
chrome.webRequest[watchIPEvent].addListener((details) => {
  if (details.type !== 'main_frame' && !_isGetIPRequest(details)) return;
  devMode && console.log(`[${watchIPEvent}]: `, details);

  let  { tabId, ip, url } = details;
  url = url.replace(/^view-source:/, '');
  url = new URL(details.url);
  let hostname = url.hostname;
  // 后台模拟请求 existing.js
  if (tabId < 0) {
    let urlParams = url.searchParams;
    tabId = Number(urlParams.get(tabIdParamName));
  }

  let tabInfo = tabInfoMap.get(tabId);
  if (!tabInfo) return;

  let tabHost = tabInfo[hostname];
  if (tabHost && ip === tabHost?.ip && tabHost?.type !== 'loopback') {
    updateTabInfo(tabId, hostname);
    return;
  }
  tabInfo[hostname] = { ip };

  checkIPAndSetTabHost(tabId, ip, hostname)
    .then(() => {
      updateTabInfo(tabId, hostname);
    });
}, {
  urls: ['<all_urls>'],
});

// 无请求页面（如chrome-extension://）
chrome.webNavigation.onCommitted.addListener((details) => {
  if (!details.url || details.frameId !== 0) return;
  devMode && console.log('[onCommitted]: ', details);

  let { tabId, url } = details;
  url = url.replace(/^view-source:/, '');
  let { isFiltered, hostname } = checkUrlAndFilter(tabId, url);
  if (isFiltered) return;

  // 处理 前进、后退 bfcache
  if (details.transitionQualifiers.includes('forward_back')) {
    updateActionDetails(tabId, hostname);
  }

  // 保底（如 Web Worker页面）
  let tabHost = tabInfoMap.get(tabId)[hostname];
  if (!tabHost) {
    updateActionDetails(tabId, hostname, {
      path: iconPath.default,
      title: titleTemplate(hostname, {}, L('noIPTip')),
    });
  }
});

// 过早执行setIcon 页面更新时 可能被重置
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || changeInfo.status === 'complete') return;
  // console.log(tabId, changeInfo, tab);

  let url = tab.url;
  url = url.replace(/^view-source:/, '');
  let hostname = new URL(url).hostname;
  updateActionDetails(tabId, hostname);
});

isFF && chrome.webRequest.onErrorOccurred.addListener((details) => {
  devMode && console.log('[onErrorOccurred]: ', details);
  
  let { tabId, url } = details;
  url = url.replace(/^view-source:/, '');
  let hostname = new URL(url).hostname;
  setTimeout(() => {
    updateActionDetails(tabId, hostname, {
      path: iconPath.error,
      title: titleTemplate(hostname, {}, details.error),
    });
  }, 100);
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
  let isFiltered = true, path, title;

  let tabInfo = tabInfoMap.get(tabId);
  if (!tabInfo) return { isFiltered };
  
  let { protocol, hostname } = new URL(url);
  protocol = protocol.slice(0, -1);

  if (protocol.startsWith('http')) {
    // 直接交给后续处理
    isFiltered = false;
  } else if (protocol.includes('extension')) {
    title = `${protocolMap.extension}`;
    path = 'icons/special/resource.png';
  } else if (['resource', 'file', 'data'].includes(protocol)) {
    title = `${protocolMap[protocol]}`;
    path = `icons/special/${protocol}.png`;
  } else if (['chrome', 'about', 'edge'].includes(protocol)) {
    title = `${protocolMap['resource']}`;
    path = `icons/special/about.png`;
  } else {
    path = iconPath.default;
  }

  if (isFiltered) {
    tabInfo[protocol] = { title, path };
    updateActionDetails(tabId, protocol);
  }

  return { isFiltered, hostname };
}

function checkIPAndSetTabHost(tabId, ip, hostname) {
  return new Promise((resolve, reject) => {
    let tabHost = tabInfoMap.get(tabId)[hostname];

    // 部分官方页面 返回ip为null
    if (!ip) {
      tabHost.path = iconPath.default;
      return resolve();
    }

    function handleLocal() {
      tabHost.location = L('localComputer');
      tabHost.path = `icons/special/proxy.png`;
    }

    let { type, ipClass } = utils.IPClassify.query(ip);
    tabHost.type = type;
    tabHost.ipClass = ipClass;

    if (type === 'public') {
      return resolve();
    } else if (type === 'private') {
      tabHost.location = L('LAN');
      tabHost.path = `icons/special/privateip.png`;
      return resolve();
    } else if (type === 'loopback') {
      // devMode && console.log(type, ip, hostname);
      ensureSettingsLoaded().then(() => {
        if (!settings.useDNS) {
          handleLocal();
          return resolve();
        }

        queryByDNS(hostname)
          .then((address) => {
            tabHost.ipFromDNS = address;
            if (utils.IPClassify.isLoopbackIP(address)) {
              tabHost.ipFromDNS = undefined;
              handleLocal();
            }
            return resolve();
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

function updateTabInfo(tabId, hostname) {
  // devMode && console.trace('updateTabInfo: ', tabId);
  let tabHost = tabInfoMap.get(tabId)[hostname];
  if (!tabHost) return;

  let { ipFromDNS, ip, path } = tabHost;

  if (path) {
    updateActionDetails(tabId, hostname);
    return;
  }

  IP2Country(ipFromDNS || ip).then((record) => {
    let country = record.country || record.registered_country,
        code = country.iso_code,
        countryName = country['names'][isoCode2Lang(code)];
    
    let tabHost = tabInfoMap.get(tabId)[hostname];
    tabHost.countryCode = code;
    tabHost.location = countryName;
    tabHost.path = `icons/flags/${code}.png`;

    updateActionDetails(tabId, hostname);
  });
}

function titleTemplate(hostname, data, extraStatus) {
  let titleInfo;
  let { ip, type, ipClass, location, ipFromDNS, title } = data;
  
  if (title) return title;

  if (extraStatus) {
      titleInfo = `
${L('domain')}:  ${hostname}\n
${extraStatus}
`;
    return titleInfo.trimStart();
}
  
  if (!ip) {
      titleInfo = `
${L('domain')}:  ${hostname}\n
${L('ipAdress')}:  ${ip}
`;
    return titleInfo.trimStart();
  }

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

function updateActionDetails(tabId, hostname, details) {
  devMode && console.trace('[updateAction]: ', tabId);

  let tabInfo = tabInfoMap.get(tabId);
  if (!tabInfo) return;

  let path, title;
  if (details) {
    ({ path, title } = details);
  } else {
    let tabHost = tabInfo[hostname];
    if (!tabHost) return;

    path = tabHost.path;
    title = titleTemplate(hostname, tabHost);
  }

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