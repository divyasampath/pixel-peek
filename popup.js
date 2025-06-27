const toggle = document.getElementById('pixelpeek-toggle');
console.log('PixelPeek popup loaded');
// Load state
chrome.storage.sync.get(['pixelpeekEnabled'], ({ pixelpeekEnabled }) => {
  console.log('Popup loaded state:', pixelpeekEnabled);
  toggle.checked = !!pixelpeekEnabled;
});
// Save state and notify content script
toggle.addEventListener('change', () => {
  chrome.storage.sync.set({ pixelpeekEnabled: toggle.checked });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('Popup sending PIXELPEEK_TOGGLE', toggle.checked);
    chrome.tabs.sendMessage(tabs[0].id, { type: 'PIXELPEEK_TOGGLE', enabled: toggle.checked });
  });
}); 