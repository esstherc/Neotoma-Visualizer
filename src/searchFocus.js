// Simple info panel to display the focused node and its ancestors
// Usage:
//   const info = setupFocusInfo();
//   info.show(d); // to display d and its ancestors
//   info.clear(); // to hide
export function setupFocusInfo() {
  const panel = document.getElementById('info');
  function show(d) {
    if (!panel || !d) return;
    const names = d.ancestors().reverse().map(n => n.data.name);
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Selected</div>
      <div>${names.map(n => `<div>${n}</div>`).join('')}</div>
    `;
    panel.style.display = 'block';
  }
  function clear() {
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'none';
  }
  // start hidden
  if (panel) panel.style.display = 'none';
  return { show, clear };
}



