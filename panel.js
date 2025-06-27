window.addEventListener('DOMContentLoaded', function() {
  console.log('panel.js loaded');
  const marginToggle = document.getElementById('toggle-margin');
  const fontToggle = document.getElementById('toggle-font');
  const measureToggle = document.getElementById('toggle-measure');
  console.log('marginToggle:', marginToggle, 'fontToggle:', fontToggle, 'measureToggle:', measureToggle);

  if (!marginToggle || !fontToggle || !measureToggle) {
    console.error('One or more toggle elements not found:', {marginToggle, fontToggle, measureToggle});
    return;
  }

  marginToggle.addEventListener('change', (e) => {
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_MARGIN', enabled: e.target.checked }, '*');
  });
  fontToggle.addEventListener('change', (e) => {
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_FONT', enabled: e.target.checked }, '*');
  });
  measureToggle.addEventListener('change', (e) => {
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_MEASURE', enabled: e.target.checked }, '*');
  });
}); 