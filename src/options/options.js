'use strict';

Object.defineProperty(Array.prototype, 'remove', {
  value: function(value) {
    const index = this.indexOf(value);
    if (index !== -1) this.splice(index, 1);
    return this;
  },
  enumerable: false,
});

const $ = (css, d = document) => d.querySelector(css);
const $$ = (css, d = document) => d.querySelectorAll(css);

const $iconMenuIdSelect = $('#iconMenuId');
const $menuList = $('.menu-list');
const $up = $('.up');
const $down = $('.down');

const sendTask = (task) => {
  return () => chrome.runtime.sendMessage({ task });
}

const menuItemsApi = {
  NEW_ID: 'NEW_USER_ID',
  userIDPre: 'userMenu-',
  userIDReg: /^userMenu-\d+$/,
  nextID(arr = menuIds) {
    let userIds = arr.filter(id => this.userIDReg.test(id));
    let numbers = userIds.map(id => {
      return id.replace(this.userIDPre, '');
    });
    let newID = Math.max(0, ...numbers) + 1;
    return this.userIDPre + newID.toString().padStart(3, '0');
  },
  add: (menuId, details) => {
    menuItems[menuId] = details;
    let menuItemEles = $$('.menu-list input');
    menuIds = Array.from(menuItemEles, ele => ele.name);
    chrome.storage.sync.set({ menuItems, menuIds })
      .then(sendTask('menu'));
  },
  update: (menuId, changes) => {
    menuItems[menuId] = Object.assign(menuItems[menuId], changes);
    chrome.storage.sync.set({ menuItems })
      .then(sendTask('menu'));
  },
  remove: menuId => {
    delete menuItems[menuId];
    menuIds.remove(menuId);
    menuIdsDisable.remove(menuId);
    
    if (menuItemsSys.hasOwnProperty(menuId)) {
      menuIdsDeleted.push(menuId);
    }
    chrome.storage.sync.set({
      menuItems,
      menuIds, menuIdsDisable, menuIdsDeleted,
    }).then(sendTask('menu'));
  },
  moved: () => {
    let menuItemEles = $$('.menu-list input');
    menuIds = Array.from(menuItemEles, ele => ele.name);
    chrome.storage.sync.set({ menuIds })
      .then(sendTask('menu'));
  },
  enable: (menuId, status) => {
    let method = status ? 'remove' : 'push';
    
    menuIdsDisable[method](menuId);
    chrome.storage.sync.set({ menuIdsDisable })
      .then(sendTask('menu'));
  },
}

const dialog = {
  showing: false,
  $ele: $('#dialog'),
  $mask: $('#mask'),
  $name: $('#edit-dialog-name'),
  $func: $('#edit-dialog-func'),
  $url: $('#edit-dialog-url'),
  $icon: $('#edit-dialog-icon'),
  $favicon: $('#edit-dialog-favicon'),
  $save: $('#edit-save'),
  init() {
    this.$save.addEventListener('click', () => this.save());
    $('#edit-cancel').addEventListener('click', () => this.close());
    $('.template-vars').addEventListener('click', (event) => {
      let target = event.target;
      if (target.tagName === 'VAR') {
        event.preventDefault();
        const selection = document.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    this.$name.addEventListener('input', (event) => {
      let isValid = event.target.checkValidity();
      this.$save.disabled = !isValid;
    });
    isFF && this.$url.addEventListener('input', debounce((event) => {
      let urlValue = this.$url.value;
      if (!urlValue) {
        this.$icon.value = '';
        this.$favicon.src = '';
      }

      let iconValue = this.$icon.value;
      if (/^(icons\/|data:image\/\w+;base64,)/.test(iconValue)) return;

      if (!urlValue.startsWith('http')) return;

      let url, faviconUrl;
      try {
        url = new URL(urlValue);
      } catch(err) {
        return false;
      }

      getFaviconFromUrl(url).then((faviconUrl) => {
        if (faviconUrl === iconValue) return;

        this.$icon.value = faviconUrl;
        fetchAndTobase64(faviconUrl).then((base64) => {
          this.$favicon.src = base64;
        });
      });
    }), 1000);
    isFF && this.$icon.addEventListener('change', (event) => {
      let iconValue = this.$icon.value;
      if (!iconValue || /^(icons\/|data:image\/\w+;base64,)/.test(iconValue)) {
        this.$favicon.src = iconValue;
        return;
      }

      if (!iconValue.startsWith('http')) return;
      fetchAndTobase64(iconValue).then((base64) => {
        this.$favicon.src = base64;
      });
    });
    this.$favicon.addEventListener('dblclick', (event) => {
      // debugger
      event.preventDefault();
      event.stopPropagation();
      this.$icon.value = '';
      this.$favicon.src = '';
    });
  },
  show(menuId) {
    this.showing = true;
    this.$mask.classList.add('mask');
    this.$ele.classList.add('flex');

    this.$ele.dataset.id = menuId;
    if (menuId === menuItemsApi.NEW_ID) {
      this.$name.value = '';
      this.$func.value = 'openUrl';
      this.$url.value = '';
      this.$icon.value = '';
      this.$favicon.src = '';
      this.$name.focus();
    } else {
      this.$name.value = menuItems[menuId].title;
      this.$func.value = menuItems[menuId].func;
      this.$url.value = menuItems[menuId].value;
      if (isFF) {
        let icon = menuItems[menuId].icons || defaultMenuIcon;
        this.$icon.value = icon[16];
        this.$favicon.src = icon[16];
      }
      this.$url.focus();
    }
    this.$save.disabled = !this.$name.checkValidity();
  },
  save() {
    if (!this.$name.checkValidity()) return;
    let menuId = this.$ele.dataset.id;
    let data = {
      title: this.$name.value,
      func: this.$func.value,
      value: this.$url.value,
    }

    if (isFF) {
      let img = this.$favicon.getAttribute('src') || defaultMenuIcon[16];
      data.icons = { 16: img }
    }

    if (menuId === menuItemsApi.NEW_ID) {
      menuId = menuItemsApi.nextID();
      let html = templateItem(menuId, data);
      let $activeEle = $('.item.active');
      if ($activeEle) {
        $activeEle.insertAdjacentHTML('afterend', html);
      } else {
        $menuList.insertAdjacentHTML('afterbegin', html);
      }

      menuItemsApi.add(menuId, data);
    } else {
      menuItemsApi.update(menuId, data);
      $(`.item[data-id=${menuId}] .title`).textContent = data.title;
      if (isFF) {
        $(`.item[data-id=${menuId}] .favicon`).src = data.icons[16];
      }
    }
    renderIconMenuIdOpts();
    this.close();
  },
  close() {
    this.showing = false;
    this.$mask.classList.remove('mask');
    this.$ele.classList.remove('flex')
  },
}

function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      controller.abort(); // 终止请求
      reject(new Error(`[request timeout]: ${timeout}ms`));
    }, timeout);
  });

  return Promise.race([
    fetch(url, { signal }), // 绑定终止信号
    timeoutPromise,
  ]);
}

function getFaviconFromUrl(targetUrl) {
  return fetchWithTimeout(targetUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const iconLink = doc.querySelector('link[rel*="icon"]');
      const baseUrl = doc.querySelector('base')?.href || targetUrl;
      
      if (iconLink) {
        const faviconPath = iconLink.getAttribute('href');
        return new URL(faviconPath, baseUrl).href;
      }
      
      return new URL('/favicon.ico', baseUrl).href;
    })
    .catch(error => {
      console.error('Fetch failed, using fallback:', error);
      return new URL('/favicon.ico', targetUrl).href;
    });
}

function fetchAndTobase64(imgUrl, timeout = 10000) {
  return fetchWithTimeout(imgUrl, timeout)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return response.blob();
    })
    .then(blob => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(blob);
      });
    })
    .then(img => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; // 抗锯齿
      ctx.drawImage(img, 0, 0, 16, 16);
      
      const base64 = canvas.toDataURL();
      URL.revokeObjectURL(img.src); // 释放内存
      return base64;
    })
    .catch(error => {
      // console.error(error.name === 'AbortError' ? '请求已取消' : error.message);
      return defaultMenuIcon[16];
    });
}

function renderIconMenuIdOpts() {
  let html = `<option value=""></option>`;
  for (let menuId of menuIds) {
    html += `<option value="${menuId}">${menuItems[menuId].title}</option>`;
  }
  $iconMenuIdSelect.innerHTML = html;
  $iconMenuIdSelect.value = settings.iconMenuId;
}

function renderMenuList() {
  let html = '';
  for (let menuId of menuIds) {
    html += templateItem(menuId);
  }
  $menuList.innerHTML = html;
}

// 新增时 传入data
function templateItem(menuId, data) {
  const item = data || menuItems[menuId];
  if (isFF && !item.icons) {
    item.icons = defaultMenuIcon;
  }
  // console.log(item);
  return `
<div class="item flex h-center gap" data-id="${menuId}">
  <input type="checkbox" name="${menuId}" ${menuIdsDisable.includes(menuId) ? "" : "checked"}>
  ${isFF ? `<img class="favicon" src="${item.icons[16]}">` : ''}
  <span class="title">${item.title}</span>
  <button class="edit e-shadow"></button>
  <button class="delete e-shadow"></button>
</div>`;
}

function handleMainClick(event) {
  // console.log(event.target);
  let target = event.target;
  let $item = target.closest('.item');

  if ($item) {
    $item.classList.add('active');
    $$('.item.active').forEach(ele => ele.classList.toggle('active', ele === $item));

    updateMoveBtnStatus();
  } else if (!target.closest('.menu-control')) {
    $$('.item.active').forEach(ele => ele.classList.remove('active'));
    
    updateMoveBtnStatus();
  }

  let tagName = target.nodeName;
  if (tagName === 'BUTTON') {
    let $activeEle, menuId;
    switch(target.classList[0]) {
      case 'add':
        dialog.show(menuItemsApi.NEW_ID);
        break;
      case 'edit':
        menuId = $item.dataset.id;
        dialog.show(menuId);
        break;
      case 'delete':
        menuId = $item.dataset.id;
        $item.remove();
        menuItemsApi.remove(menuId);
        $(`[value="${menuId}"]` ,$iconMenuIdSelect).remove();
        updateMoveBtnStatus();
        break;
      case 'up':
        $activeEle = $('.item.active');
        let $previous = $activeEle.previousElementSibling;
        if ($previous) {
          $menuList.insertBefore($activeEle, $previous);
          updateMoveBtnStatus();
          menuItemsApi.moved();
          renderIconMenuIdOpts();
        }
        break;
      case 'down':
        $activeEle = $('.item.active');
        let $next = $activeEle.nextElementSibling;
        if ($next) {
          $menuList.insertBefore($activeEle, $next.nextElementSibling);
          updateMoveBtnStatus();
          menuItemsApi.moved();
          renderIconMenuIdOpts();
        }
        break;
    }
  } else if (tagName === 'INPUT') {
    menuItemsApi.enable(target.name, target.checked);
  }
}

function updateMoveBtnStatus() {
  let $activeEle = $('.item.active');
  if (!$activeEle) {
    $up.disabled = true;
    $down.disabled = true;
  } else {
    $up.disabled = $activeEle.previousElementSibling === null;
    $down.disabled = $activeEle.nextElementSibling === null;
  }
}

function changeHandler(event) {
  let newValue = this.type == 'checkbox'
      ? this.checked : this.value;
  // console.log(this.name, newValue);

  settings[this.name] = newValue;
  chrome.storage.sync.set({ settings })
    .then(sendTask('settings'));
}

function initSettings() {
  // 读数据
  for (let key in settings) {
    let value = settings[key];
    // console.log(`${key}: ${value}`);
    let $ele = $(`[name=${key}]`);

    if (!$ele) {
      // console.log(`[未设置选项] ${key}: ${value}`)
      continue;
    }

    if ($ele.type == 'checkbox') {
      $ele.checked = value;
    } else {
      $ele.value = value;
    }

    $ele.addEventListener('change', changeHandler);
  }

  if (!chrome.dns) {
    let $useDNS = $('[name=useDNS]');
    $useDNS.disabled = true;
    $useDNS.removeEventListener('change', changeHandler);
  }

  $('#version').textContent = chrome.runtime.getManifest().version;
  chrome.runtime.sendMessage({ task: "GeoIPBuildTime" })
    .then(time => {
      const date = new Date(time * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const localeDate = date.toLocaleDateString(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      
      const $geo = $('#GeoIPDB');
      $geo.title = `${L('GeoIPDate')}${localeDate}`;
      $geo.textContent = `& ${year}/${month}`;
    });
}

// 备份与恢复
$('#exportBtn').addEventListener('click', exportConfig);

$('#importBtn').addEventListener('click', () => {
  handleFileSelect({
    accept: '.json', // 限制 json 文件
    onFileSelected: (files) => {
      const [file] = files;
      return importConfig(file).then(() => {
        sendTask('menu')();
        location.reload();
      });
    }
  });
});

$('#resetBtn').addEventListener('click', () => {
  if (confirm(L('resetConfigTip'))) {
    resetConfig()
    .then(initSysData)
    .then(() => {
      sendTask('menu')();
      location.reload();
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  dragula({
      revertOnSpill: true,
      os: 'pc',
      mirrorContainer: $menuList,
      isContainer: function (el) {
        return el.classList.contains('menu-list');
      },
    }).on('dragend', (el, target, source, sibling, isHover) => {
      // console.log(el, target, source, sibling, isHover);
      updateMoveBtnStatus();
      menuItemsApi.moved();
    });
});


loadSettings().then(() => {
  initSettings();
  renderIconMenuIdOpts();
  renderMenuList();
});

$('main').addEventListener('click', handleMainClick);
dialog.init();
i18nLocalize();
