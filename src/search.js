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
  let isShowingDetails = false; // Track if we're showing details of a single result
  
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
  
  function showSearchResultsList() {
    // Show the list of all search results
    isShowingDetails = false;
    const panel = document.getElementById('info');
    if (!panel || currentMatches.length === 0) return;
    
    highlightAllMatches(currentMatches);
    
    const matchList = currentMatches.map((m, idx) => {
      const path = m.ancestors().reverse().map(n => n.data.name).join(' / ');
      return `<div style="cursor:pointer;padding:4px 0;border-bottom:1px solid #e5e7eb;" data-index="${idx}" class="search-result-item">${path}</div>`;
    }).join('');
    
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Search Results (${currentMatches.length} matches)</div>
      <div style="max-height:300px;overflow-y:auto;">${matchList}</div>
    `;
    panel.style.display = 'block';
    
    // Add click handlers for each result
    panel.querySelectorAll('.search-result-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        currentMatchIndex = idx;
        isShowingDetails = true;
        const selectedNode = currentMatches[idx];
        focusNode(selectedNode);
        showNodeDetails(selectedNode);
      });
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f3f4f6';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
    });
  }
  
  function showNodeDetails(selectedNode) {
    // Show details of a single selected node with back button
    const panel = document.getElementById('info');
    if (!panel) return;
    
    const names = selectedNode.ancestors().reverse().map(n => n.data.name);
    
    // Only show back button if there are multiple matches to go back to
    const backButton = currentMatches.length > 1 ? `
      <button id="backToResults" style="
        margin-top: 12px;
        padding: 8px 16px;
        background: linear-gradient(135deg, #43a047, #43a047);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        font-family: 'DM Sans', sans-serif;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      " onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='brightness(1)'">
        Back to Results
      </button>
    ` : '';
    
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Search Results (${names.length} matches)</div>
      <div>${names.map(n => `<div>${n}</div>`).join('')}</div>
      ${backButton}
    `;
    panel.style.display = 'block';
    
    // Add back button handler if it exists
    const backBtn = document.getElementById('backToResults');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (info) info.clear();
        showSearchResultsList();
      });
    }
  }
  
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  
  function runSearch() {
    if (!searchInput) return;
    const q = searchInput.value.trim();
    
    // Clear previous focus labels before starting new search
    if (info) info.clear();
    
    if (!q) {
      // Clear search results
      currentMatches = [];
      currentMatchIndex = -1;
      link.classed('highlight', false);
      node.select('text').classed('highlight', false);
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
      // Single match - focus directly and show details
      isShowingDetails = true;
      focusNode(matches[0]);
      showNodeDetails(matches[0]);
    } else {
      // Multiple matches - show list
      showSearchResultsList();
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

