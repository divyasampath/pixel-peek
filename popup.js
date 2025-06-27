document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle-enabled');

  // Get the current tab and check if PixelPeek is enabled
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, { type: 'PIXELPEEK_QUERY_ENABLED' }, (response) => {
      if (response && typeof response.enabled === 'boolean') {
        toggle.checked = response.enabled;
      } else {
        toggle.checked = true; // Default to enabled
      }
    });
  });

  toggle.addEventListener('change', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id, { type: 'PIXELPEEK_TOGGLE_ENABLED', enabled: toggle.checked });
    });
  });
}); 