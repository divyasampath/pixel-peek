console.log('PixelPeek: background.js loaded');

chrome.action.onClicked.addListener((tab) => {
  console.log('PixelPeek: Extension icon clicked, sending toggle message to tab', tab.id);
  chrome.tabs.sendMessage(tab.id, { type: 'PIXELPEEK_TOGGLE_PANEL' }, () => {
    if (chrome.runtime.lastError) {
      console.warn('PixelPeek: No content script in this tab.', chrome.runtime.lastError.message);
    } else {
      console.log('PixelPeek: Toggle message sent successfully');
    }
  });
}); 