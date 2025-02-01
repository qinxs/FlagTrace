'use strict';

const _context = isFF ? ['page_action'] : ['action'];

const lazyLoadSettings = debounce(loadSettings);
const lazyInitMenus = debounce(initMenus, 1000);

lazyInitMenus();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // console.log(info, tab);
  safeOnMenuClick('contextMenus', info, tab);
});

// 模拟区分单击 双击
let iconClickCount = 0, clickType,
    sensitivity = 250, lastRunTime = 0;
chrome.action.onClicked.addListener((tab) => {
  // 防止重复执行
  if (Date.now() - lastRunTime < sensitivity) return;

  iconClickCount++;
  clickType = iconClickCount > 1 ? 'dblclick' : 'click';
  
  if (iconClickCount > 1) return;
  setTimeout(() => {
    safeOnMenuClick(clickType, {}, tab);
    lastRunTime = Date.now();
    iconClickCount = 0;
  }, sensitivity);
});

function createContextMenus() {
  // 动态计算主菜单项数量
  let menuIdsValid = menuIds.filter(id => {
    return !menuIdsDisable.includes(id);
  });
  let totalLength = menuIdsValid.length;
  // 浏览器限制添加菜单最长为6
  // 超过6则主菜单显示5+“更多”，否则显示全部
  // firefox 额外添加选项菜单
  let mainLength = (isFF ? totalLength + 1 : totalLength) > 6 ? 5 : 6;

  const mainItems = menuIdsValid.slice(0, mainLength);
  const moreItems = menuIdsValid.slice(mainLength);
  // console.log(mainItems, moreItems);

  mainItems.forEach(id => {
    let menuItem = menuItems[id];
    let item = {
      id,
      title: menuItem.title,
      contexts: _context,
    }
    if (isFF) {
      item.icons = menuItem.icons || defaultMenuIcon;
    }
    chrome.contextMenus.create(item);
  });

  if (moreItems.length > 0) {
    chrome.contextMenus.create({
      id: 'more',
      title: 'More ...',
      contexts: _context,
    });

    moreItems.forEach(id => {
      let menuItem = menuItems[id];
      let item = {
        id,
        parentId: 'more',
        title: menuItem.title,
        contexts: _context,
      }
      if (isFF) {
        item.icons = menuItem.icons || defaultMenuIcon;
      }
      chrome.contextMenus.create(item);
    });
  }

  // 包含more菜单
  return moreItems.length > 0;
}

function createOptionMenu(hasMoreMenu) {
  const separator = {
    id: "separator-1",
    type: "separator",
  }

  const options = {
    id: 'options',
    title: L('options'),
    contexts: _context,
    icons: {
      16: 'icons/favicon/options.png',
    }
  }

  if (hasMoreMenu) {
    separator.parentId = 'more';
    options.parentId = 'more';
  }

  hasMoreMenu && chrome.contextMenus.create(separator);
  chrome.contextMenus.create(options);
}

function onMenuClick(menuId, tab) {
  if (menuId == 'options') {
    chrome.tabs.create({url: '/options.html'});
    return;
  }
  
  let item = menuItems[menuId];
  if (!item) return;
  if (!item.value) return;

  switch (item.func) {
    case 'openUrl':
      utils.parseUrl(item.value, tab).then(utils.openUrl);
      break;
    case 'openUrlDirectly':
      utils.openUrl(item.value);
      break;
    case 'copy':
      // @TODO 网站会提示需要复制授权
      // utils.copyText(new Date().toLocaleString());
      utils.parseUrl(item.value, tab)
        .then((text) => {
          utils.copyText(text);
        });
      break;
    default:
      break;
  }
}

function safeOnMenuClick(apiType, info, tab) {
  if (settings) {
    _checkAndDoMenuClick();
  } else {
    // mv3 Service Worker失活
    loadSettings().then(() => {
      _checkAndDoMenuClick();
    });
  }

  function _checkAndDoMenuClick() {
    let menuId;
    if (apiType === 'contextMenus') {
      menuId = info.menuItemId;
    } else {
      if (apiType !== settings.iconClick) return;
      menuId = settings.iconMenuId;
    }

    onMenuClick(menuId, tab);
  }
}

function initMenus() {
  // console.log('initMenus');
  loadSettings().then(() => {
    chrome.contextMenus.removeAll();
    let hasMoreMenu = createContextMenus();
    isFF && createOptionMenu(hasMoreMenu);
  });
}
