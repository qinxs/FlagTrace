'use strict';

const settingsSys = {
  iconMenuId: '',
  iconClick: 'dblclick',
  openIn: '0b11', // 新标签页、前后台打开 详细参见utils.openUrl
  useDNS: true,
}
if (!chrome.dns) {
  settingsSys.useDNS = false;
}

// 在控制台执行 `devMode = !devMode` 切换
let devMode = false;

// menuIds存储顺序
let settings, menuItems, menuIds, menuIdsDisable;
// 记录用户删除的内置菜单 保证后期在程序里可以新增
let menuIdsDeleted;

const isFF = navigator.userAgent.includes('Firefox');
if (isFF) {
  chrome = browser;
  chrome.action = chrome.pageAction;
}

const L = chrome.i18n.getMessage;
const uiLang = chrome.i18n.getUILanguage();
const debounce = (fn, delay = 500) => {
  let timer;
  return function () {
    let args = arguments;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  }
}

const defaultMenuIcon = {
  16: 'icons/favicon/default.png',
}

const menuItemsSys = {
  seoCheck: {
    title: 'SEO综合查询',
    func: 'openUrl',
    value: 'https://seo.chinaz.com/{hostname}',
    icons: {
      16: 'icons/favicon/seoCheck.ico',
    }
  },
  IPGeolocation: {
    title: 'IP Geolocation',
    func: 'openUrl',
    value: 'https://browserleaks.com/ip/{ip}',
    icons: {
      16: 'icons/favicon/IPGeolocation.png',
    }
  },
  ShortURL: {
    title: 'Short URL',
    func: 'openUrl',
    value: 'https://tinyurl.com/api-create.php?url={url}',
    icons: {
      16: 'icons/favicon/ShortURL.ico',
    }
  },
  w3techs: {
    title: 'W3techs',
    func: 'openUrl',
    value: 'http://w3techs.com/sites/info/{hostname}',
    icons: {
      16: 'icons/favicon/w3techs.ico',
    }
  },
  copyIP: {
    title: 'Copy IP',
    func: 'copy',
    value: '{ip}',
    icons: {
      16: 'icons/favicon/copy.png',
    }
  },
  whoIs: {
    title: 'Whois',
    func: 'openUrl',
    value: 'https://www.whois.com/whois/{hostname}',
    icons: {
      16: 'icons/favicon/whois.ico',
    }
  },
  pingUrl: {
    title: 'Ping检测',
    func: 'openUrl',
    value: 'https://www.itdog.cn/ping/{hostname}',
    icons: {
      16: 'icons/favicon/ping.ico',
    }
  },
  httpObservatory: {
    title: 'Security Observatory',
    func: 'openUrl',
    value: 'https://developer.mozilla.org/en-US/observatory/analyze?host={hostname}',
  },
  userAgent: {
    title: 'User Agent',
    func: 'openUrl',
    value: 'https://whatmyuseragent.com/',
    icons: {
      16: 'icons/favicon/userAgent.ico',
    }
  },
}
const menuIdsSysDisable = [
  'whoIs',
  'pingUrl',
  'httpObservatory',
  'userAgent',
];

function initSysData() {
  return chrome.storage.sync.set({
    menuItems: menuItemsSys,
    menuIds: Object.keys(menuItemsSys),
    menuIdsDisable: menuIdsSysDisable,
    menuIdsDeleted: [],
  });
}

function loadSettings() {
  return chrome.storage.sync.get(null).then((result) => {
    settings = Object.assign({}, settingsSys, result.settings);
    
    menuIds = result.menuIds;
    menuIdsDisable = result.menuIdsDisable;
    menuIdsDeleted = result.menuIdsDeleted;
    menuItems = result.menuItems;
  });
}