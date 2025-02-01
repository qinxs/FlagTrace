// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'copy-text-offscreen') {
    const success = copyToClipboard(message.text);
    sendResponse({ success: success });
    return true; // 保持通道开放以异步响应
  }
});

function copyToClipboard(text) {
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  try {
    const success = document.execCommand('copy');
    return success;
  } catch (e) {
    console.error('Offscreen copy failed:', e);
    return false;
  } finally {
    document.body.removeChild(input);
  }
}
