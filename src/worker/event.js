"use strict";

chrome.runtime.onInstalled.addListener(async (details) => {
  // console.log(details);
  if (details.reason === 'install') {
    initSysData().then(lazyInitMenus);
  } else if (details.reason === 'update') {
    clearGeoDB();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log(message, sender);
  let task = message.task;
  if (task === 'settings') {
    lazyLoadSettings();
  } else if (task === 'menu') {
    lazyInitMenus();
  } else if (task === 'GeoIPBuildTime') {
    getGeoIPBuildTime().then((time) => {
      sendResponse(time); // chrome 必须显式发送响应？
    });
    return true; // 异步返回true
  } else {
    console.log('[invalid task: ]', message);
  }
  
  return false;
});
