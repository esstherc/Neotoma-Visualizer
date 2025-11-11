// Search functionality for the radial tree visualization
// Usage:
//   setupSearch({
//     root,                    // d3.hierarchy root node
//     link,                    // d3 selection of links
//     node,                    // d3 selection of nodes
//     info,                    // info panel object with show() and clear() methods
//     setCurrentRotate,         // function to set current rotation
//     updateRotate,             // function to update rotation transform
//     updateLabelOrientation    // function to update label orientation
//   });

export function setupSearch({
  root,
  link,
  node,
  info,
  setCurrentRotate,
  updateRotate,
  updateLabelOrientation
}) {
  const idToNode = new Map();
  root.descendants().forEach(n => idToNode.set(n.data.id, n));
  let currentMatches = [];
  let currentMatchIndex = -1;
  
  function focusNode(d) {
    setCurrentRotate(90 - (d.x * 180 / Math.PI));
    updateRotate();
    updateLabelOrientation();
    const A = new Set(d.ancestors());
    link.classed('highlight', l => A.has(l.source) && A.has(l.target));
    node.select('text').classed('highlight', n => A.has(n));
    if (info) info.show(d);
  }
  
  function highlightAllMatches(matches) {
    // Clear previous highlights
    link.classed('highlight', false);
    node.select('text').classed('highlight', false);
    
    if (matches.length === 0) return;
    
    // Create a set of matching node IDs for quick lookup
    const matchIds = new Set(matches.map(m => m.data.id));
    
    // Highlight all matching nodes and their paths
    const allAncestors = new Set();
    matches.forEach(m => {
      m.ancestors().forEach(a => allAncestors.add(a));
    });
    
    link.classed('highlight', l => allAncestors.has(l.source) && allAncestors.has(l.target));
    node.select('text').classed('highlight', d => matchIds.has(d.data.id));
  }
  
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  
  function runSearch() {
    if (!searchInput) return;
    const q = searchInput.value.trim();
    if (!q) {
      // Clear search results
      currentMatches = [];
      currentMatchIndex = -1;
      link.classed('highlight', false);
      node.select('text').classed('highlight', false);
      if (info) info.clear();
      return;
    }
    
    let matches = [];
    const id = Number(q);
    if (!Number.isNaN(id) && idToNode.has(id)) {
      // Exact ID match
      matches = [idToNode.get(id)];
    } else {
      // Fuzzy name search - find all matches
      const lower = q.toLowerCase();
      matches = root.descendants().filter(n => 
        (n.data.name || '').toLowerCase().includes(lower)
      );
    }
    
    currentMatches = matches;
    currentMatchIndex = -1;
    
    if (matches.length === 0) {
      if (info) {
        const panel = document.getElementById('info');
        if (panel) {
          panel.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">Search Results</div><div style="color:#6b7280;">No matches found for "${q}"</div>`;
          panel.style.display = 'block';
        }
      }
      highlightAllMatches([]);
    } else if (matches.length === 1) {
      // Single match - focus directly
      focusNode(matches[0]);
    } else {
      // Multiple matches - show list and highlight all
      highlightAllMatches(matches);
      if (info) {
        const panel = document.getElementById('info');
        if (panel) {
          const matchList = matches.map((m, idx) => {
            const path = m.ancestors().reverse().map(n => n.data.name).join(' / ');
            return `<div style="cursor:pointer;padding:4px 0;border-bottom:1px solid #e5e7eb;" data-index="${idx}" class="search-result-item">${path}</div>`;
          }).join('');
          panel.innerHTML = `
            <div style="font-weight:600;margin-bottom:6px;">Search Results (${matches.length} matches)</div>
            <div style="max-height:300px;overflow-y:auto;">${matchList}</div>
          `;
          panel.style.display = 'block';
          
          // Add click handlers for each result
          panel.querySelectorAll('.search-result-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
              currentMatchIndex = idx;
              // Focus on selected node and highlight only its path
              const selectedNode = matches[idx];
              focusNode(selectedNode);
            });
            item.addEventListener('mouseenter', () => {
              item.style.backgroundColor = '#f3f4f6';
            });
            item.addEventListener('mouseleave', () => {
              item.style.backgroundColor = 'transparent';
            });
          });
        }
      }
    }
  }
  
  if (searchBtn) searchBtn.addEventListener('click', runSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter') {
        runSearch();
      } else if (e.key === 'ArrowDown' && currentMatches.length > 0) {
        e.preventDefault();
        currentMatchIndex = currentMatchIndex < 0 ? 0 : Math.min(currentMatchIndex + 1, currentMatches.length - 1);
        const selectedNode = currentMatches[currentMatchIndex];
        // Focus on selected node and highlight only its path
        focusNode(selectedNode);
      } else if (e.key === 'ArrowUp' && currentMatches.length > 0) {
        e.preventDefault();
        currentMatchIndex = currentMatchIndex < 0 ? currentMatches.length - 1 : Math.max(currentMatchIndex - 1, 0);
        const selectedNode = currentMatches[currentMatchIndex];
        // Focus on selected node and highlight only its path
        focusNode(selectedNode);
      }
    });
    // Clear results when input is cleared
    searchInput.addEventListener('input', (e) => {
      if (!e.target.value.trim()) {
        currentMatches = [];
        currentMatchIndex = -1;
        link.classed('highlight', false);
        node.select('text').classed('highlight', false);
        if (info) info.clear();
      }
    });
  }
}

