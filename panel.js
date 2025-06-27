window.addEventListener('DOMContentLoaded', function() {
  console.log('panel.js loaded');
  const marginBtn = document.getElementById('btn-margin');
  const fontBtn = document.getElementById('btn-font');
  const copyCssBtn = document.getElementById('btn-copy-css');
  const buttons = [marginBtn, fontBtn, copyCssBtn];

  function setActive(btn) {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  marginBtn.addEventListener('click', () => {
    setActive(marginBtn);
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_MARGIN', enabled: true }, '*');
  });
  fontBtn.addEventListener('click', () => {
    setActive(fontBtn);
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_FONT', enabled: true }, '*');
  });
  copyCssBtn.addEventListener('click', () => {
    setActive(copyCssBtn);
    parent.postMessage({ type: 'PIXELPEEK_TOGGLE_COPY_CSS', enabled: true }, '*');
  });

  // Optionally, set default active mode
  setActive(marginBtn);
}); 