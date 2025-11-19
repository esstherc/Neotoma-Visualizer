// Simple info panel to display the focused node and its ancestors
// Also displays taxon name label on the dendrogram
// Usage:
//   const info = setupFocusInfo(node, getCurrentRotate);
//   info.show(d); // to display d and its ancestors + label on dendrogram
//   info.clear(); // to hide
export function setupFocusInfo(nodeSelection, getCurrentRotate = () => 0) {
  const panel = document.getElementById('info');
  let currentNode = null; // Store current node for button handler
  
  function show(d) {
    if (!panel || !d) return;
    
    currentNode = d; // Store current node
    
    // Update info panel
    const names = d.ancestors().reverse().map(n => n.data.name);
    
    // Check if node has children (can have a subtree)
    // A node can have a subtree if:
    // 1. It has children in the current tree, OR
    // 2. We can check if there's data available to build a subtree
    const hasSubtree = (d.children && d.children.length > 0) || 
                      (d.descendants && d.descendants().length > 1); // Has descendants beyond itself
    
    // Add "Go to Tree" button only if node has a subtree and navigateToNode is available
    const goToTreeButton = (hasSubtree && window.navigateToNode) ? `
      <button id="goToTreeFromClick" style="
        margin-top: 12px;
        padding: 8px 16px;
        background: linear-gradient(135deg, #2563eb, #2563eb);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        font-family: 'DM Sans', sans-serif;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      " onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='brightness(1)'">
        Go to Tree
      </button>
    ` : '';
    
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Search Results (${names.length} matches)</div>
      <div style="margin-bottom:8px;"><strong>Path:</strong> ${names.map(n => `<div style="margin-left:12px;">${n}</div>`).join('')}</div>
      ${goToTreeButton}
    `;
    panel.style.display = 'block';
    
    // Add event listener for "Go to Tree" button
    const goToTreeBtn = document.getElementById('goToTreeFromClick');
    if (goToTreeBtn && window.navigateToNode) {
      // Remove any existing listeners by cloning the button
      const newBtn = goToTreeBtn.cloneNode(true);
      goToTreeBtn.parentNode.replaceChild(newBtn, goToTreeBtn);
      
      newBtn.addEventListener('click', () => {
        const nodeData = d.data;
        const taxagroupid = nodeData.taxagroupid || 'MAM';
        window.navigateToNode(nodeData.id, nodeData.name, taxagroupid);
      });
    }
    
    // Add taxon name labels to all nodes in the path
    if (nodeSelection) {
      // Remove any existing focus labels
      nodeSelection.selectAll('.focus-label').remove();
      
      // Get all ancestors (the complete path from root to selected node)
      const pathNodes = d.ancestors();
      
      // Add labels to all nodes in the path
      // Calculate label orientation based on current rotation
      const currentRotate = getCurrentRotate();
      const rotRad = (currentRotate * Math.PI) / 180;
      const tau = Math.PI * 2;
      function outward(node) { 
        return ((node.x + rotRad) % tau + tau) % tau < Math.PI; 
      }
      
      pathNodes.forEach(ancestorNode => {
        const nodeGroup = nodeSelection.filter(n => n === ancestorNode);
        
        nodeGroup.append('text')
          .attr('class', 'focus-label')
          .attr('dy', '0.32em')
          .attr('x', node => (outward(node) === !node.children ? 16 : -16))
          .attr('text-anchor', node => (outward(node) === !node.children ? 'start' : 'end'))
          .attr('transform', node => outward(node) ? null : 'rotate(180)')
          .style('fill', '#2e7d32')
          .style('font-size', '14px')
          .style('font-weight', '700')
          .style('pointer-events', 'none')
          .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 3px white')
          .text(ancestorNode.data.name);
      });
    }
  }
  
  function clear() {
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'none';
    
    // Remove focus labels from dendrogram
    if (nodeSelection) {
      nodeSelection.selectAll('.focus-label').remove();
    }
  }
  
  // start hidden
  if (panel) panel.style.display = 'none';
  return { show, clear };
}



