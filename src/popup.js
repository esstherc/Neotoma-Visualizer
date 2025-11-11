export function createPopup(anchorId = 'popup') {
  const popup = document.getElementById(anchorId);
  function hide() { if (popup) { popup.style.left = '-9999px'; popup.style.top = '-9999px'; } }
  function showAt(pageX, pageY, title, htmlContent = '') {
    if (!popup) return;
    const content = `<div style="font-weight:600;margin-bottom:6px;">${title}</div>` +
                    `<div>${htmlContent}</div>` +
                    `<div style=\"margin-top:8px;text-align:right;\"><button id=\"popupClose\">Close</button></div>`;
    popup.innerHTML = content;
    const pad = 8;
    popup.style.left = (pageX + pad) + 'px';
    popup.style.top = (pageY + pad) + 'px';
    const btn = document.getElementById('popupClose');
    if (btn) btn.onclick = hide;
  }
  return { showAt, hide };
}


