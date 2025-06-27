import tippy, { followCursor } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import interact from 'interactjs';
import { annotate } from 'rough-notation';

console.log('PixelPeek: content_script.js loaded');

let pixelpeekEnabled = false;
let lockedElement = null;
let tippyInstance = null;
let spacingMode = false;
let spacingSelection = [];
let spacingLine = null;
let spacingLabel = null;
let marginMode = false;
let fontInfoMode = false;
let measureMode = false;
let fontTippyInstance = null;
let measureStartEl = null;
let measureEndEl = null;
let measureLine = null;
let measureLabel = null;

// Listen for toggle messages from background (extension icon click)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PIXELPEEK_TOGGLE_PANEL') {
    console.log('PixelPeek: Received toggle panel message');
    const panel = document.getElementById('pixelpeek-panel-iframe');
    if (panel) {
      panel.remove();
      console.log('PixelPeek: Panel removed');
    } else {
      injectPanelIframe();
      console.log('PixelPeek: Panel injected');
    }
  }
});

// On load, check storage for enabled state
chrome.storage.sync.get(['pixelpeekEnabled'], ({ pixelpeekEnabled: enabled }) => {
  console.log('Content script loaded state:', enabled);
  pixelpeekEnabled = !!enabled;
  setPixelPeekEnabled(pixelpeekEnabled);
});

function setPixelPeekEnabled(enabled) {
  console.log('setPixelPeekEnabled called with', enabled);
  if (enabled) {
    activatePixelPeek();
    injectPanelIframe();
  } else {
    deactivatePixelPeek();
    document.getElementById('pixelpeek-panel-iframe')?.remove();
  }
}

function activatePixelPeek() {
  if (window.pixelpeekActive) return;
  window.pixelpeekActive = true;
  if (!document.body.contains(shadowHost)) document.body.appendChild(shadowHost);
  shadowHost.style.display = '';
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
}

function deactivatePixelPeek() {
  window.pixelpeekActive = false;
  if (document.body.contains(shadowHost)) shadowHost.style.display = 'none';
  overlay.style.display = 'none';
  marginOverlay.style.display = 'none';
  paddingOverlay.style.display = 'none';
  labelNames.forEach(side => {
    marginLabels[side].style.display = 'none';
    paddingLabels[side].style.display = 'none';
  });
  if (tippyInstance) {
    tippyInstance.destroy();
    tippyInstance = null;
  }
  lockedElement = null;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  // Remove all rough-notation overlays
  document.querySelectorAll('.pixelpeek-rough-annotation').forEach(el => el.remove());
  // Remove any other overlays or tooltips
  if (fontTippyInstance) {
    fontTippyInstance.destroy();
    fontTippyInstance = null;
  }
  document.removeEventListener('mouseover', onFontInfoHover, true);
  document.removeEventListener('mouseout', onFontInfoOut, true);
  // Remove margin/padding overlays if any
  // ... add any additional cleanup here ...
}

// --- Inject Shadow DOM Root ---
const shadowHost = document.createElement('div');
shadowHost.id = 'pixelpeek-shadow-host';
document.body.appendChild(shadowHost);
const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

// --- Overlay Logic ---
const overlay = document.createElement('div');
overlay.id = 'pixelpeek-overlay';
overlay.style.position = 'fixed';
overlay.style.pointerEvents = 'none';
overlay.style.zIndex = 2147483646;
overlay.style.border = '2px dashed #888';
overlay.style.display = 'none';
overlay.style.background = 'rgba(0,0,0,0.01)';
shadowRoot.appendChild(overlay);

const marginOverlay = document.createElement('div');
marginOverlay.id = 'pixelpeek-margin';
marginOverlay.style.position = 'fixed';
marginOverlay.style.pointerEvents = 'none';
marginOverlay.style.zIndex = 2147483645;
marginOverlay.style.background = 'rgba(255, 165, 0, 0.08)';
marginOverlay.style.display = 'none';
marginOverlay.style.border = '2px dashed orange';
shadowRoot.appendChild(marginOverlay);

const paddingOverlay = document.createElement('div');
paddingOverlay.id = 'pixelpeek-padding';
paddingOverlay.style.position = 'fixed';
paddingOverlay.style.pointerEvents = 'none';
paddingOverlay.style.zIndex = 2147483646;
paddingOverlay.style.background = 'rgba(30, 144, 255, 0.08)';
paddingOverlay.style.display = 'none';
paddingOverlay.style.border = '2px dashed #1e90ff';
shadowRoot.appendChild(paddingOverlay);

const labelNames = ['top', 'right', 'bottom', 'left'];
const marginLabels = {};
const paddingLabels = {};
labelNames.forEach(side => {
  const mLabel = document.createElement('div');
  mLabel.className = 'pixelpeek-label pixelpeek-margin-label';
  mLabel.style.position = 'fixed';
  mLabel.style.zIndex = 2147483647;
  mLabel.style.background = 'rgba(255, 165, 0, 0.15)';
  mLabel.style.color = '#fff';
  mLabel.style.fontFamily = 'monospace';
  mLabel.style.fontSize = '12px';
  mLabel.style.padding = '2px 6px';
  mLabel.style.borderRadius = '6px';
  mLabel.style.pointerEvents = 'none';
  mLabel.style.display = 'none';
  shadowRoot.appendChild(mLabel);
  marginLabels[side] = mLabel;

  const pLabel = document.createElement('div');
  pLabel.className = 'pixelpeek-label pixelpeek-padding-label';
  pLabel.style.position = 'fixed';
  pLabel.style.zIndex = 2147483647;
  pLabel.style.background = 'rgba(30, 144, 255, 0.15)';
  pLabel.style.color = '#fff';
  pLabel.style.fontFamily = 'monospace';
  pLabel.style.fontSize = '12px';
  pLabel.style.padding = '2px 6px';
  pLabel.style.borderRadius = '6px';
  pLabel.style.pointerEvents = 'none';
  pLabel.style.display = 'none';
  shadowRoot.appendChild(pLabel);
  paddingLabels[side] = pLabel;
});

function updateOverlay(target) {
  if (lockedElement && marginMode) {
    target = lockedElement;
  }
  if (!target || !marginMode) {
    overlay.style.display = 'none';
    marginOverlay.style.display = 'none';
    paddingOverlay.style.display = 'none';
    labelNames.forEach(side => {
      marginLabels[side].style.display = 'none';
      paddingLabels[side].style.display = 'none';
    });
    if (tippyInstance) {
      tippyInstance.destroy();
      tippyInstance = null;
    }
    return;
  }
  const rect = target.getBoundingClientRect();
  const style = window.getComputedStyle(target);
  const margin = {
    top: parseFloat(style.marginTop),
    right: parseFloat(style.marginRight),
    bottom: parseFloat(style.marginBottom),
    left: parseFloat(style.marginLeft)
  };
  const padding = {
    top: parseFloat(style.paddingTop),
    right: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    left: parseFloat(style.paddingLeft)
  };
  const border = {
    top: parseFloat(style.borderTopWidth),
    right: parseFloat(style.borderRightWidth),
    bottom: parseFloat(style.borderBottomWidth),
    left: parseFloat(style.borderLeftWidth)
  };
  marginOverlay.style.left = (rect.left - margin.left) + 'px';
  marginOverlay.style.top = (rect.top - margin.top) + 'px';
  marginOverlay.style.width = (rect.width + margin.left + margin.right) + 'px';
  marginOverlay.style.height = (rect.height + margin.top + margin.bottom) + 'px';
  marginOverlay.style.display = 'block';
  paddingOverlay.style.left = (rect.left + border.left) + 'px';
  paddingOverlay.style.top = (rect.top + border.top) + 'px';
  paddingOverlay.style.width = (rect.width - border.left - border.right) + 'px';
  paddingOverlay.style.height = (rect.height - border.top - border.bottom) + 'px';
  paddingOverlay.style.display = 'block';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  overlay.style.display = 'block';
  marginLabels.top.textContent = margin.top + 'px';
  marginLabels.top.style.left = (rect.left + rect.width / 2 - 18) + 'px';
  marginLabels.top.style.top = (rect.top - margin.top + 2) + 'px';
  marginLabels.top.style.display = 'block';
  marginLabels.right.textContent = margin.right + 'px';
  marginLabels.right.style.left = (rect.right + margin.right - 36) + 'px';
  marginLabels.right.style.top = (rect.top + rect.height / 2 - 10) + 'px';
  marginLabels.right.style.display = 'block';
  marginLabels.bottom.textContent = margin.bottom + 'px';
  marginLabels.bottom.style.left = (rect.left + rect.width / 2 - 18) + 'px';
  marginLabels.bottom.style.top = (rect.bottom + margin.bottom - 18) + 'px';
  marginLabels.bottom.style.display = 'block';
  marginLabels.left.textContent = margin.left + 'px';
  marginLabels.left.style.left = (rect.left - margin.left + 2) + 'px';
  marginLabels.left.style.top = (rect.top + rect.height / 2 - 10) + 'px';
  marginLabels.left.style.display = 'block';
  paddingLabels.top.textContent = padding.top + 'px';
  paddingLabels.top.style.left = (rect.left + border.left + (rect.width - border.left - border.right) / 2 - 18) + 'px';
  paddingLabels.top.style.top = (rect.top + border.top + 2) + 'px';
  paddingLabels.top.style.display = 'block';
  paddingLabels.right.textContent = padding.right + 'px';
  paddingLabels.right.style.left = (rect.right - border.right - 36) + 'px';
  paddingLabels.right.style.top = (rect.top + border.top + (rect.height - border.top - border.bottom) / 2 - 10) + 'px';
  paddingLabels.right.style.display = 'block';
  paddingLabels.bottom.textContent = padding.bottom + 'px';
  paddingLabels.bottom.style.left = (rect.left + border.left + (rect.width - border.left - border.right) / 2 - 18) + 'px';
  paddingLabels.bottom.style.top = (rect.bottom - border.bottom - 18) + 'px';
  paddingLabels.bottom.style.display = 'block';
  paddingLabels.left.textContent = padding.left + 'px';
  paddingLabels.left.style.left = (rect.left + border.left + 2) + 'px';
  paddingLabels.left.style.top = (rect.top + border.top + (rect.height - border.top - border.bottom) / 2 - 10) + 'px';
  paddingLabels.left.style.display = 'block';
}

function onMouseOver(e) {
  if (!marginMode) return;
  if (shadowHost.contains(e.target)) return;
  updateOverlay(e.target);
}
function onMouseOut(e) {
  if (!marginMode) return;
  updateOverlay(null);
}
document.addEventListener('mouseover', onMouseOver, true);
document.addEventListener('mouseout', onMouseOut, true);

// --- Click-to-lock selection and tooltip ---
function lockSelection(target) {
  if (!marginMode) return;
  lockedElement = target;
  updateOverlay(target);
  showTooltip(target);
}
function clearSelection() {
  lockedElement = null;
  updateOverlay(null);
  if (tippyInstance) {
    tippyInstance.destroy();
    tippyInstance = null;
  }
}
function showTooltip(target) {
  const style = window.getComputedStyle(target);
  const color = style.color;
  const font = `${style.fontSize} ${style.fontFamily}`;
  const background = style.backgroundColor || '#FFFFFF';
  const width = Math.round(target.getBoundingClientRect().width);
  const height = Math.round(target.getBoundingClientRect().height);
  // Accessibility (basic example)
  const role = target.getAttribute('role') || 'generic';
  const name = target.getAttribute('aria-label') || target.getAttribute('alt') || '';
  const keyboard = target.tabIndex >= 0 ? 'Yes' : 'No';

  const html = `
    <div style='min-width:220px;max-width:320px;padding:10px 14px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.10);font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.6;color:#373C44;'>
      <div style='color:#a0207a;font-weight:600;font-size:15px;margin-bottom:2px;'>html <span style="float:right;font-size:13px;font-weight:400;color:#888;">${width} × ${height}</span></div>
      <div style='margin-bottom:6px;'>
        <div><span style="color:#888;">Color</span> <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;border:1px solid #ccc;vertical-align:middle;margin-right:4px;"></span><span style="color:#373C44;">${color}</span></div>
        <div><span style="color:#888;">Font</span> <span style="color:#373C44;">${font}</span></div>
        <div><span style="color:#888;">Background</span> <span style="display:inline-block;width:12px;height:12px;background:${background};border-radius:2px;border:1px solid #ccc;vertical-align:middle;margin-right:4px;"></span><span style="color:#373C44;">${background}</span></div>
      </div>
      <div style='border-top:1px solid #eee;margin:8px 0 4px 0;'></div>
      <div style='font-size:12px;color:#888;font-weight:600;margin-bottom:2px;'>ACCESSIBILITY</div>
      <div style='font-size:13px;'>
        <div><span style="color:#888;">Name</span> <span style="color:#373C44;">${name}</span></div>
        <div><span style="color:#888;">Role</span> <span style="color:#373C44;">${role}</span></div>
        <div><span style="color:#888;">Keyboard-focusable</span> <span style="color:#373C44;">${keyboard === 'Yes' ? '<span style=\'color:#1976d2\'>&#10003;</span>' : '<span style=\'color:#888\'>&#10007;</span>'}</span></div>
      </div>
    </div>`;

  if (tippyInstance) tippyInstance.destroy();
  tippyInstance = tippy(target, {
    content: html,
    allowHTML: true,
    placement: 'right',
    appendTo: () => document.body,
    showOnCreate: true,
    interactive: false,
    theme: 'light',
    zIndex: 2147483647,
    popperOptions: {
      modifiers: [
        {
          name: 'preventOverflow',
          options: {
            boundary: document.body,
            padding: 8
          }
        },
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['left', 'bottom', 'top']
          }
        }
      ]
    }
  });
  tippyInstance.show();
}
document.addEventListener('click', function (e) {
  if (!marginMode) return;
  if (shadowHost.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  lockSelection(e.target);
}, true);
document.addEventListener('keydown', function (e) {
  if (!marginMode) return;
  if (e.key === 'Escape') {
    clearSelection();
  }
}, true);

// --- Spacing Mode ---
function clearSpacingSelection() {
  spacingSelection = [];
  if (spacingLine && spacingLine.parentNode) spacingLine.parentNode.removeChild(spacingLine);
  if (spacingLabel && spacingLabel.parentNode) spacingLabel.parentNode.removeChild(spacingLabel);
  spacingLine = null;
  spacingLabel = null;
}
function onSpacingClick(e) {
  if (!spacingMode) return;
  if (shadowHost.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  if (spacingSelection.length < 2) {
    spacingSelection.push(e.target);
    if (spacingSelection.length === 2) {
      drawSpacingOverlay(spacingSelection[0], spacingSelection[1]);
    }
  } else {
    clearSpacingSelection();
    spacingSelection.push(e.target);
  }
}
function drawSpacingOverlay(el1, el2) {
  if (spacingLine && spacingLine.parentNode) spacingLine.parentNode.removeChild(spacingLine);
  if (spacingLabel && spacingLabel.parentNode) spacingLabel.parentNode.removeChild(spacingLabel);
  const r1 = el1.getBoundingClientRect();
  const r2 = el2.getBoundingClientRect();
  const edges = [
    { dir: 'h', val: Math.abs(r1.left - r2.right), x1: r1.left, y1: r1.top + r1.height / 2, x2: r2.right, y2: r2.top + r2.height / 2 },
    { dir: 'h', val: Math.abs(r1.right - r2.left), x1: r1.right, y1: r1.top + r1.height / 2, x2: r2.left, y2: r2.top + r2.height / 2 },
    { dir: 'v', val: Math.abs(r1.top - r2.bottom), x1: r1.left + r1.width / 2, y1: r1.top, x2: r2.left + r2.width / 2, y2: r2.bottom },
    { dir: 'v', val: Math.abs(r1.bottom - r2.top), x1: r1.left + r1.width / 2, y1: r1.bottom, x2: r2.left + r2.width / 2, y2: r2.top }
  ];
  edges.sort((a, b) => a.val - b.val);
  const closest = edges[0];
  spacingLine = document.createElement('div');
  spacingLine.style.position = 'fixed';
  spacingLine.style.zIndex = 2147483647;
  spacingLine.style.background = '#1976d2';
  spacingLine.style.pointerEvents = 'none';
  if (closest.dir === 'h') {
    spacingLine.style.height = '2px';
    spacingLine.style.width = Math.abs(closest.x2 - closest.x1) + 'px';
    spacingLine.style.left = Math.min(closest.x1, closest.x2) + 'px';
    spacingLine.style.top = (closest.y1 - 1) + 'px';
  } else {
    spacingLine.style.width = '2px';
    spacingLine.style.height = Math.abs(closest.y2 - closest.y1) + 'px';
    spacingLine.style.left = (closest.x1 - 1) + 'px';
    spacingLine.style.top = Math.min(closest.y1, closest.y2) + 'px';
  }
  shadowRoot.appendChild(spacingLine);
  spacingLabel = document.createElement('div');
  spacingLabel.style.position = 'fixed';
  spacingLabel.style.zIndex = 2147483647;
  spacingLabel.style.background = '#1976d2';
  spacingLabel.style.color = '#fff';
  spacingLabel.style.fontSize = '14px';
  spacingLabel.style.fontWeight = 'bold';
  spacingLabel.style.padding = '4px 12px';
  spacingLabel.style.borderRadius = '8px';
  spacingLabel.style.pointerEvents = 'none';
  spacingLabel.style.boxShadow = '0 2px 8px rgba(25, 118, 210, 0.10)';
  spacingLabel.style.display = 'flex';
  spacingLabel.style.flexDirection = 'column';
  spacingLabel.style.alignItems = 'center';
  spacingLabel.style.gap = '2px';
  // If both values are 0, show both stacked, else show only one
  let labelText = Math.round(closest.val) + 'px';
  if (r1.top === r2.top && r1.left === r2.left) {
    labelText = '<span>0px</span><span>0px</span>';
  }
  spacingLabel.innerHTML = labelText;
  if (closest.dir === 'h') {
    spacingLabel.style.left = (Math.min(closest.x1, closest.x2) + Math.abs(closest.x2 - closest.x1) / 2 - 18) + 'px';
    spacingLabel.style.top = (closest.y1 - 28) + 'px';
  } else {
    spacingLabel.style.left = (closest.x1 - 28) + 'px';
    spacingLabel.style.top = (Math.min(closest.y1, closest.y2) + Math.abs(closest.y2 - closest.y1) / 2 - 18) + 'px';
  }
  shadowRoot.appendChild(spacingLabel);
}
document.addEventListener('click', function (e) {
  if (!spacingMode) return;
  onSpacingClick(e);
}, true);
document.addEventListener('keydown', function (e) {
  if (!spacingMode) return;
  if (e.key === 'Escape') {
    clearSpacingSelection();
  }
}, true);

// --- Font Info Toggle ---
function showFontInfoTooltip(target, event) {
  if (fontTippyInstance) {
    fontTippyInstance.destroy();
    fontTippyInstance = null;
  }
  const style = window.getComputedStyle(target);
  const fontSize = style.fontSize;
  const fontFamily = style.fontFamily;
  const fontWeight = style.fontWeight;
  const color = style.color;
  const html = `
    <div style='min-width:180px;max-width:320px;padding:10px 16px 10px 16px;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.10);font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:13.5px;line-height:1.5;color:#373C44;border:1.5px solid #e0e0e0;'>
      <div style='color:#a0207a;font-weight:600;font-size:15px;margin-bottom:4px;'>Font Info</div>
      <div style='margin-bottom:6px;'>
        <div style="color:#888;margin-bottom:2px;">Size <span style='color:#373C44;font-weight:500;'>${fontSize}</span></div>
        <div style="color:#888;margin-bottom:2px;">Weight <span style='color:#373C44;font-weight:500;'>${fontWeight}</span></div>
        <div style="color:#888;margin-bottom:2px;">Family <span style='color:#373C44;font-weight:500;'>${fontFamily}</span></div>
        <div style="color:#888;">Color <span style='color:${color};font-weight:500;'>${color}</span></div>
      </div>
    </div>`;
  fontTippyInstance = tippy(target, {
    content: html,
    allowHTML: true,
    placement: 'bottom',
    appendTo: () => document.body,
    showOnCreate: true,
    interactive: false,
    theme: 'light',
    zIndex: 2147483647,
    plugins: [followCursor],
    followCursor: 'initial',
    trigger: 'manual',
    popperOptions: {
      modifiers: [
        {
          name: 'preventOverflow',
          options: {
            boundary: document.body,
            padding: 8
          }
        },
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['top', 'left', 'right']
          }
        }
      ]
    }
  });
  fontTippyInstance.show();
}
function onFontInfoHover(e) {
  if (!fontInfoMode) return;
  if (marginMode || spacingMode) return;
  if (shadowHost.contains(e.target)) return;
  showFontInfoTooltip(e.target, e);
}
function onFontInfoOut(e) {
  if (fontTippyInstance) {
    fontTippyInstance.destroy();
    fontTippyInstance = null;
  }
}
document.addEventListener('mouseover', onFontInfoHover, true);
document.addEventListener('mouseout', onFontInfoOut, true);

// --- Example: Use Rough Notation for hand-drawn annotation on double-click ---
document.addEventListener('dblclick', function (e) {
  if (shadowHost.contains(e.target)) return;
  const annotation = annotate(e.target, {
    type: 'box',
    color: '#f44336',
    padding: 5,
    strokeWidth: 2,
    iterations: 3
  });
  annotation.show();
}, true);

// --- Panel iframe injection logic ---
function injectPanelIframe() {
  if (document.getElementById('pixelpeek-panel-iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.id = 'pixelpeek-panel-iframe';
  iframe.src = chrome.runtime.getURL('panel.html');
  iframe.style.position = 'fixed';
  iframe.style.top = '80px';
  iframe.style.right = '40px';
  iframe.style.zIndex = '2147483647';
  iframe.style.width = '50px';
  iframe.style.height = '190px';
  iframe.style.border = 'none';
  iframe.style.background = 'none';
  iframe.style.boxShadow = 'rgba(0, 0, 0, 0.2) 0px 2px 16px';
  iframe.style.borderRadius = '12px';
  iframe.style.border = '1px solid #e0e0e0';
  iframe.allow = 'clipboard-read; clipboard-write';
  document.body.appendChild(iframe);
}

// Listen for messages from the panel iframe
window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  console.log('PixelPeek: Received message', event.data);
  switch (event.data.type) {
    case 'PIXELPEEK_CLOSE_PANEL':
      document.getElementById('pixelpeek-panel-iframe')?.remove();
      break;
    case 'PIXELPEEK_TOGGLE_MARGIN':
      marginMode = event.data.enabled;
      fontInfoMode = false;
      if (measureMode) { disableMeasureMode(); measureMode = false; }
      if (marginMode) {
        activatePixelPeek();
      } else {
        deactivatePixelPeek();
      }
      break;
    case 'PIXELPEEK_TOGGLE_FONT':
      fontInfoMode = event.data.enabled;
      marginMode = false;
      if (measureMode) { disableMeasureMode(); measureMode = false; }
      if (fontInfoMode) {
        document.addEventListener('mouseover', onFontInfoHover, true);
        document.addEventListener('mouseout', onFontInfoOut, true);
      } else {
        document.removeEventListener('mouseover', onFontInfoHover, true);
        document.removeEventListener('mouseout', onFontInfoOut, true);
        if (fontTippyInstance) {
          fontTippyInstance.destroy();
          fontTippyInstance = null;
        }
      }
      break;
    case 'PIXELPEEK_TOGGLE_SPACING':
      spacingMode = event.data.enabled;
      if (!spacingMode) clearSpacingSelection();
      break;
    case 'PIXELPEEK_TOGGLE_MEASURE':
      measureMode = event.data.enabled;
      marginMode = false;
      fontInfoMode = false;
      if (measureMode) {
        enableMeasureMode();
      } else {
        disableMeasureMode();
      }
      break;
  }
});

function clearMeasureOverlay() {
  if (measureLine && measureLine.parentNode) measureLine.parentNode.removeChild(measureLine);
  if (measureLabel && measureLabel.parentNode) measureLabel.parentNode.removeChild(measureLabel);
  measureLine = null;
  measureLabel = null;
  measureStartEl = null;
  measureEndEl = null;
}

function onMeasureClick(e) {
  // Ignore clicks on the toolbar iframe
  const toolbar = document.getElementById('pixelpeek-panel-iframe');
  if (toolbar && (toolbar === e.target || toolbar.contains(e.target))) return;
  if (!measureStartEl) {
    measureStartEl = e.target;
    clearMeasureOverlay();
  } else if (!measureEndEl) {
    measureEndEl = e.target;
    drawMeasureOverlay(measureStartEl, measureEndEl);
    // Reset for next measurement
    measureStartEl = null;
    measureEndEl = null;
  }
  e.preventDefault();
  e.stopPropagation();
}

function drawMeasureOverlay(el1, el2) {
  clearMeasureOverlay();
  const r1 = el1.getBoundingClientRect();
  const r2 = el2.getBoundingClientRect();
  // Find closest points between the two boxes
  const x1 = r1.left + r1.width / 2;
  const y1 = r1.top + r1.height / 2;
  const x2 = r2.left + r2.width / 2;
  const y2 = r2.top + r2.height / 2;
  // Draw a dashed line
  measureLine = document.createElement('div');
  measureLine.style.position = 'fixed';
  measureLine.style.zIndex = 2147483647;
  measureLine.style.pointerEvents = 'none';
  measureLine.style.borderTop = '2px dashed #1976d2';
  measureLine.style.left = Math.min(x1, x2) + 'px';
  measureLine.style.top = Math.min(y1, y2) + 'px';
  measureLine.style.width = Math.hypot(x2 - x1, y2 - y1) + 'px';
  measureLine.style.transformOrigin = '0 0';
  measureLine.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
  shadowRoot.appendChild(measureLine);
  // Add a label with the distance
  measureLabel = document.createElement('div');
  measureLabel.style.position = 'fixed';
  measureLabel.style.zIndex = 2147483647;
  measureLabel.style.pointerEvents = 'none';
  measureLabel.style.background = '#fff';
  measureLabel.style.border = '1.5px dashed #1976d2';
  measureLabel.style.color = '#1976d2';
  measureLabel.style.fontFamily = 'monospace';
  measureLabel.style.fontSize = '13px';
  measureLabel.style.padding = '2px 8px';
  measureLabel.style.borderRadius = '6px';
  measureLabel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  measureLabel.textContent = Math.round(Math.hypot(x2 - x1, y2 - y1)) + ' px';
  // Place label at the midpoint
  measureLabel.style.left = ((x1 + x2) / 2 - 24) + 'px';
  measureLabel.style.top = ((y1 + y2) / 2 - 18) + 'px';
  shadowRoot.appendChild(measureLabel);
}

function enableMeasureMode() {
  document.addEventListener('click', onMeasureClick, true);
}
function disableMeasureMode() {
  document.removeEventListener('click', onMeasureClick, true);
  clearMeasureOverlay();
} 