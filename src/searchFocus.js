// Simple info panel to display the focused node and its ancestors
// Also displays taxon name label on the dendrogram
// Usage:
//   const info = setupFocusInfo(node);
//   info.show(d); // to display d and its ancestors + label on dendrogram
//   info.clear(); // to hide
export function setupFocusInfo(nodeSelection) {
  const panel = document.getElementById('info');
  
  function show(d) {
    if (!panel || !d) return;
    
    // Update info panel
    const names = d.ancestors().reverse().map(n => n.data.name);
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Search Results (${names.length} matches)</div>
      <div>${names.map(n => `<div>${n}</div>`).join('')}</div>
    `;
    panel.style.display = 'block';
    
    // Add taxon name labels to all nodes in the path
    if (nodeSelection) {
      // Remove any existing focus labels
      nodeSelection.selectAll('.focus-label').remove();
      
      // Get all ancestors (the complete path from root to selected node)
      const pathNodes = d.ancestors();
      
      // Add labels to all nodes in the path
      pathNodes.forEach(ancestorNode => {
        const nodeGroup = nodeSelection.filter(n => n === ancestorNode);
        
        nodeGroup.append('text')
          .attr('class', 'focus-label')
          .attr('dy', '0.32em')
          .attr('x', node => (node.x < Math.PI) === !node.children ? 16 : -16)
          .attr('text-anchor', node => (node.x < Math.PI) === !node.children ? 'start' : 'end')
          .attr('transform', node => node.x >= Math.PI ? 'rotate(180)' : null)
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



