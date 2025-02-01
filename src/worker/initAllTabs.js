'use strict';

function initAllTabs() {
  setTimeout(() => {
    chrome.tabs.query({ currentWindow: true }).then((tabs) => {
      // console.log('once', tabs);
      for (const tab of tabs) {
        tabInfoMap.set(tab.id, {});

        // onCommitted 或者 watchIPEvent
        if (!tab.url || tab.discarded) continue;

        let { isFiltered, hostname } = checkUrlAndFilter(tab.id, tab.url);
        if (isFiltered) continue;

        // console.log(tab.url, tab.id);
        _getIPbyNewRequest(tab.url, tab.id);
      }
    });
  }, 0);
}
initAllTabs();

let tabIdParamName = `ext_FlagTrace_tabId`;
function _getIPbyNewRequest(url, tabId = -1) {
  const urlObj = new URL(url);
  urlObj.searchParams.append(tabIdParamName, tabId);
  
  let fetchUrl = urlObj.toString();
  // console.log('NewRequest: ', fetchUrl);
  
  return fetch(fetchUrl, {
    method: 'HEAD',
    // cache: 'no-cache',
    credentials: 'omit',
    mode: 'no-cors',
    redirect: 'follow', // 强制允许跟随重定向
    headers: {
      'Referer': url,
    }
  }).then((response ) => {
    if (response.ok) {
      return true;
    }
  }).catch(err => console.info(err));
}

let extensionURL = chrome.runtime.getURL('').slice(0, -1);
function _isGetIPRequest (details) {
  let initiator = details.initiator || details.originUrl;
  if (!initiator) return false;
  return initiator.startsWith(extensionURL) && details.method === 'HEAD';
}
