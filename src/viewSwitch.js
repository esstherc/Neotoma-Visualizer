// View Switch functionality: Switch between Whole View and Focus View
// Focus View shows only the highlighted path, Whole View shows the full tree

let currentHighlightedPath = null; // The currently highlighted node path
let currentMatchIds = new Set(); // IDs of all currently matched nodes (from search)
let isFocusView = false; // Current view state
let originalRows = null; // Store original rows for restoring
let originalRootInfo = null; // Store original root info
let renderFunction = null; // Store the render function reference
let allRowsForSynonyms = null; // Store all rows for synonyms

/**
 * Initialize view switch functionality
 * @param {Function} renderFn - Function to render the tree (takes rows, rootId, rootName, allRowsForSynonyms)
 * @param {Array} rows - Original rows data
 * @param {Object} rootInfo - Root info {rootId, rootName}
 * @param {String} taxagroupid - Current taxagroupid
 * @param {Array} allRows - All rows for synonyms
 */
export function initViewSwitch(renderFn, rows, rootInfo, taxagroupid, allRows) {
  renderFunction = renderFn;
  originalRows = rows;
  originalRootInfo = rootInfo;
  allRowsForSynonyms = allRows;
  
  const wholeViewBtn = document.getElementById('wholeViewBtn');
  const focusViewBtn = document.getElementById('focusViewBtn');
  
  if (wholeViewBtn) {
    wholeViewBtn.addEventListener('click', () => {
      if (!isFocusView) return; // Already in whole view
      switchToWholeView();
    });
  }
  
  if (focusViewBtn) {
    focusViewBtn.addEventListener('click', () => {
      if (isFocusView) return; // Already in focus view
      switchToFocusView();
    });
  }
  
  updateButtonState();
}

/**
 * Set the currently highlighted path
 * @param {Object} node - The highlighted node (d3.hierarchy node)
 */
export function setHighlightedPath(node) {
  if (!node) {
    currentHighlightedPath = null;
    return;
  }
  
  // Store the path from root to this node
  const ancestors = node.ancestors().reverse();
  currentHighlightedPath = {
    node: node,
    path: ancestors, // Root to node
    pathIds: ancestors.map(n => n.data.id)
  };
  
  console.log('setHighlightedPath called', {
    nodeName: node.data.name,
    nodeId: node.data.id,
    pathIds: currentHighlightedPath.pathIds,
    isFocusView
  });
  
  // If in focus view, update the view
  if (isFocusView) {
    switchToFocusView();
  }
}

/**
 * Set the matched node IDs from search results
 * @param {Set|Array} matchIds - Set or array of matched node IDs
 */
export function setMatchIds(matchIds) {
  currentMatchIds = matchIds instanceof Set ? matchIds : new Set(matchIds);
  console.log('setMatchIds called', {
    count: currentMatchIds.size,
    ids: Array.from(currentMatchIds).slice(0, 10)
  });
}

/**
 * Clear the highlighted path
 */
export function clearHighlightedPath() {
  currentHighlightedPath = null;
  currentMatchIds.clear();
  if (isFocusView) {
    switchToWholeView();
  }
}

/**
 * Switch to Focus View - show only the highlighted path
 */
async function switchToFocusView() {
  console.log('switchToFocusView called', {
    hasPath: !!currentHighlightedPath,
    hasMatchIds: currentMatchIds.size > 0,
    hasRows: !!originalRows,
    hasRenderFn: !!renderFunction,
    pathIds: currentHighlightedPath?.pathIds,
    matchIdsCount: currentMatchIds.size
  });
  
  // Check if we have match IDs or highlighted path
  if (currentMatchIds.size === 0 && !currentHighlightedPath) {
    alert('Please search or select a path first, then switch to Focus View.');
    return;
  }
  
  if (!originalRows || !renderFunction) {
    console.warn('Cannot switch to Focus View: missing data or render function', {
      originalRows: !!originalRows,
      renderFunction: !!renderFunction
    });
    return;
  }
  
  isFocusView = true;
  updateButtonState();
  
  // Filter rows: include all rows that contain any of the matched node IDs
  // This is much simpler and more reliable than trying to match paths
  let filteredRows = [];
  
  if (currentMatchIds.size > 0) {
    // Use match IDs from search results - this is the most reliable approach
    filteredRows = originalRows.filter(row => {
      const rowIds = (row.ids_root_to_leaf || []).map(id => Number(id));
      // Check if any matched ID is in this row's path
      return Array.from(currentMatchIds).some(matchId => rowIds.includes(Number(matchId)));
    });
    
    console.log('Filtered by match IDs:', {
      originalCount: originalRows.length,
      filteredCount: filteredRows.length,
      matchIdsCount: currentMatchIds.size,
      sampleMatchIds: Array.from(currentMatchIds).slice(0, 5)
    });
  } else if (currentHighlightedPath) {
    // Fallback: use highlighted path if no match IDs available
    const highlightedNodeId = currentHighlightedPath.pathIds[currentHighlightedPath.pathIds.length - 1];
    filteredRows = originalRows.filter(row => {
      const rowIds = (row.ids_root_to_leaf || []).map(id => Number(id));
      return rowIds.includes(Number(highlightedNodeId));
    });
    
    console.log('Filtered by highlighted node ID:', {
      originalCount: originalRows.length,
      filteredCount: filteredRows.length,
      nodeId: highlightedNodeId
    });
  }
  
  if (filteredRows.length === 0) {
    console.warn('No rows found for Focus View', {
      hasMatchIds: currentMatchIds.size > 0,
      hasPath: !!currentHighlightedPath
    });
    return;
  }
  
  // Re-render with filtered data
  console.log('Rendering with filtered data...', filteredRows.length, 'rows');
  await renderFunction(filteredRows, originalRootInfo.rootId, originalRootInfo.rootName, allRowsForSynonyms);
  console.log('Rendering complete');
}

/**
 * Switch to Whole View - show the full tree
 */
async function switchToWholeView() {
  if (!originalRows || !renderFunction) {
    console.warn('Cannot switch to Whole View: missing original data');
    return;
  }
  
  isFocusView = false;
  updateButtonState();
  
  // Re-render with original data
  await renderFunction(originalRows, originalRootInfo.rootId, originalRootInfo.rootName, allRowsForSynonyms);
}

/**
 * Update the button state based on current view
 */
function updateButtonState() {
  const wholeViewBtn = document.getElementById('wholeViewBtn');
  const focusViewBtn = document.getElementById('focusViewBtn');
  
  if (wholeViewBtn) {
    if (isFocusView) {
      wholeViewBtn.classList.remove('active');
    } else {
      wholeViewBtn.classList.add('active');
    }
  }
  
  if (focusViewBtn) {
    if (isFocusView) {
      focusViewBtn.classList.add('active');
    } else {
      focusViewBtn.classList.remove('active');
    }
  }
}

/**
 * Check if currently in Focus View
 */
export function isInFocusView() {
  return isFocusView;
}

/**
 * Reset view state (called when tree is reloaded)
 */
export function resetViewState() {
  isFocusView = false;
  currentHighlightedPath = null;
  currentMatchIds.clear();
  updateButtonState();
}

