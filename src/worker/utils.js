'use strict';

const utils = {};

/**
 * @flag [0b]00-11
 * 高位1 在新标签打开; 0当前标签打开
 * 低位1 在前台打开; 0在后台
 */
utils.openUrl = url => {
  let flag = settings.openIn;

  if (flag & 0b10) {
    chrome.tabs.create({
      url,
      active: Boolean(flag & 0b01),
    });
  } else {
    chrome.tabs.update({ url: url });
  }
}

// 格式形如 {url}
const templateVars = [
  'url', 'title',
  'lang', 'lang0', 'lang1',
  'origin', 'hostname', 'pathname', 'search', 'hash', 'protocol', 'port',
  'ip', 'country', 'countryCode',
];
const hasTplVarReg = new RegExp(`{(${templateVars.join('|')})}`, 'g');
const hasTitleInfoReg = new RegExp(`{(ip|country|countryCode)}`);

utils.parseUrl = (url, tab) => {
  return new Promise((resolve) => {
    if (!hasTplVarReg.test(url)) {
      return resolve(url);
    }

    const tabUrl = new URL(tab.url);
    let [ lang0, lang1 ] = uiLang.split('-');

    const varsBox = {
      lang: uiLang,
      lang0: lang0,
      lang1: lang1 || lang0,
      url: tab.url,
      title: tab.title,
      origin: tabUrl.origin,
      hostname: tabUrl.hostname,
      pathname: tabUrl.pathname,
      search: tabUrl.search,
      hash: tabUrl.hash,
      protocol: tabUrl.protocol,
      port: tabUrl.port,
    }
    
    const thisPromise = hasTitleInfoReg.test(url)
      ? chrome.action.getTitle({tabId: tab.id}).then((titleInfo) => {
        // console.log(titleInfo);
        const reg = new RegExp(`(?<=(${L('location')}|${L('ipAdress')}|${L('ipAdressFromDNS')}):\\s*)(\\S[^\\n]+)`, 'g');
        let matchs = titleInfo.match(reg) || [];
        if (isFF) {
          matchs = matchs.map(item => item.trim());
        }
        // 注意：顺序与titleInfo中的书写顺序一致
        varsBox.ip = matchs[0];
        let countryInfo = matchs.pop().split(' - ');
        varsBox.country = countryInfo[0];
        varsBox.countryCode = countryInfo[1];
      })
      : Promise.resolve();

    thisPromise
      .catch(() => {})
      .finally(() => {
        let parsedUrl = url.replaceAll(hasTplVarReg, (match) => {
          let key = match.slice(1, -1);
          return varsBox[key];
        });
        resolve(parsedUrl);
      });
  });
}

utils.copyText = (() => {
  if (isFF) {
    return (text) => {
      text = _formatCopyText(text);
      navigator.clipboard.writeText(text).catch(e => {
        console.log('copy failed: ', e);
      });
    }
  } else {
    return (text) => {
      text = _formatCopyText(text);

      chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: [chrome.offscreen.Reason.CLIPBOARD],
        justification: 'Copy text to clipboard',
      })
      .then(() => {
        return chrome.runtime.sendMessage({
          type: 'copy-text-offscreen',
          text: text,
        })
      })
      .then((response) => {
        if (!response || !response.success) {
          throw new Error('Copy failed.');
        }
      })
      .finally(() => {
        chrome.offscreen.closeDocument();
      });
    }
  }
})();

function _formatCopyText(text) {
  return text.replaceAll('{tab}', '\t');
}

// IP地址分类
// 输入IP 均是合法IP
utils.IPClassify = {
  isLoopbackIP: (ip) => ip.startsWith('127.') || ip === '::1',
  isIP4: (ip) => !ip.includes(':'),
  IP4Classify: (ip) => {
    const parts = ip.split('.').map(Number);

    if (parts[0] === 10) {
      return { type: 'private', ipClass: 'A' };
    } else if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return { type: 'private', ipClass: 'B' };
    } else if (parts[0] === 192 && parts[1] === 168) {
      return { type: 'private', ipClass: 'C' };
    }

    return { type: 'public' };
  },
  IP6Classify: (ip) => {
    const prefix = ip.split('::')[0].split(':')[0];

    // 唯一本地地址(ULA) fc00::/7
    if (prefix.startsWith('fc') || prefix.startsWith('fd')) {
      return { type: 'private', ipClass: 'ULA' };
    }
    // 链路本地地址 fe80::/10
    if (prefix === 'fe80') {
      return { type: 'private', ipClass: 'LLA' };
    }

    return { type: 'public' };
  },
  query: function (ip) {
    if (this.isLoopbackIP(ip)) {
      return { type: 'loopback' };
    }

    return this.isIP4(ip) ? this.IP4Classify(ip) : this.IP6Classify(ip);
  },
};
utils.IPClassify.query = utils.IPClassify.query.bind(utils.IPClassify);
