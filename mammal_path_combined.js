import { applyAngleCulling } from './src/labelCulling.js';
import { setupFocusInfo } from './src/searchFocus.js';
import { normalizeRows, pathsToTree, addMissingSynonyms } from './src/data.js';
import { createPopup } from './src/popup.js';
import { highlightPath } from './src/highlight.js';
import { enrichTreeWithPaths, reorderTreeForGrouping, computeLeafOrder } from './src/grouping.js';
import { setupSearch } from './src/search.js';
import { initSynonyms, getSynonymInfo, isSynonymsReady } from './src/synonyms.js';
import { setHighlightedPath, clearHighlightedPath } from './src/viewSwitch.js';
// Data helpers now imported from ./src/data.js

/**
 * Render a radial dendrogram from Neotoma mammal paths.
 * Usage:
 *   renderMammalTree({
 *     rows,                         // your path-list rows
 *     selector: '#chart',           // container CSS selector
 *     rootId: 6171,                 // Mammalia
 *     rootName: 'Mammalia',
 *     size: 900,                    // svg width/height
 *     margin: 40                    // extra padding
 *   });
 */
async function renderMammalTree({
  rows,
  allRowsForSynonyms = null,  // Optional: all rows including those filtered out, for adding synonym nodes
  selector = '#chart',
  rootId = 6171,
  rootName = 'Mammalia',
  size = 900,
  margin = 40,
  groupDepth = 3,  // Depth for grouping (0=root, 3=typically family level)
  groupPadding = 0.1,  // Extra angle (in radians) between groups (~5.7 degrees)
  siblingSeparation = 0.3,  // Minimum angle between siblings (in radians)
} = {}) {
  if (!rows || !rows.length) {
    console.warn('renderMammalTree: rows is empty.');
    return;
  }
  
  // Initialize synonym data for search functionality
  await initSynonyms();

  // 1) Build hierarchy from path-list
  const normalizedRows = normalizeRows(rows);
  const { root: treeData, byId } = pathsToTree(normalizedRows, rootId, rootName);
  
  // 1.5) Add missing synonyms to the tree
  const synonymManager = {
    isReady: () => isSynonymsReady(),
    getSynonymInfo: (id) => getSynonymInfo(id)
  };
  // Use allRowsForSynonyms if provided, otherwise use rows
  const rowsForSynonymLookup = allRowsForSynonyms || rows;
  addMissingSynonyms(treeData, byId, synonymManager, rowsForSynonymLookup);
  
  // Enrich tree with path information for grouping
  enrichTreeWithPaths(treeData, normalizedRows);
  
  const root = d3.hierarchy(treeData);

  // 1.5) Reorder tree to group leaves by family
  reorderTreeForGrouping(root, groupDepth);
  
  // Compute leaf order and store groupKey on each node
  const { leafToIndex, leafGroups } = computeLeafOrder(root, groupDepth);
  
  // Store groupKey on each leaf node for easy access
  leafGroups.forEach((item) => {
    item.leaf._groupKey = item.groupKey;
  });
  
  // For internal nodes, compute a representative groupKey from their leaves
  // If a node contains leaves from multiple groups, mark it as mixed
  root.each(d => {
    if (d.children && d.children.length > 0) {
      const leaves = d.leaves();
      if (leaves.length > 0) {
        const groups = new Set(leaves.map(l => l._groupKey).filter(Boolean));
        if (groups.size === 1) {
          // All leaves belong to the same group
          d._groupKey = Array.from(groups)[0];
        } else if (groups.size > 1) {
          // Mixed groups - use null to indicate this
          d._groupKey = null;
        }
      }
    }
  });

  // 2) Layout with custom separation
  const radius = (size / 2) - margin;
  
  // Custom separation function: smaller angle within groups, larger between groups
  // Note: d3.cluster.separation receives two adjacent sibling nodes
  function customSeparation(a, b) {
    // If either node is the root, use default separation
    if (!a.parent || !b.parent || a.parent !== b.parent) return 1;
    
    const groupA = a._groupKey;
    const groupB = b._groupKey;
    
    // If either node is mixed (null), use default separation
    if (!groupA || !groupB) return 1;
    
    if (groupA === groupB) {
      // Same group: use smaller separation
      return siblingSeparation;
    } else {
      // Different groups: add significant padding to create visual gap
      return 1 + groupPadding;
    }
  }
  
  d3.cluster()
    .size([2 * Math.PI, radius])
    .separation(customSeparation)(root);

  // 3) SVG scaffold
  const svg = d3.select(selector).append('svg')
    .attr('viewBox', [-size / 2, -size / 2, size, size])
    .attr('width', size)
    .attr('height', size);

  // Wrap content in two groups: viewport (pan+zoom) -> rotator (rotate)
  const gViewport = svg.append('g').attr('class', 'viewport').attr('transform', 'translate(0,0) scale(1)');
  const gRoot = gViewport.append('g').attr('class', 'rotator').attr('transform', 'rotate(0)');

  // Track transform state for rotate + zoom
  let currentRotate = 0;
  let currentScale = 1;
  let currentTranslateX = 0;
  let currentTranslateY = 0;
  const zoomValueEl = document.getElementById('zoomValue');
  function updateViewport() {
    gViewport.attr('transform', `translate(${currentTranslateX},${currentTranslateY}) scale(${currentScale})`);
    if (zoomValueEl) zoomValueEl.textContent = `${currentScale.toFixed(1)}\u00D7`;
  }
  function updateRotate() {
    gRoot.attr('transform', `rotate(${currentRotate})`);
  }

  // 4) Links
  const linkGen = d3.linkRadial()
    .angle(d => d.x)
    .radius(d => d.y);

  const link = gRoot.append('g')
    .attr('fill', 'none')
    .attr('stroke', '#9aa0a6')
    .attr('stroke-opacity', 0.8)
    .selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', linkGen);

  // Click on a link: treat as focusing its target node
  let linkClickTimer = null;
  link.style('cursor', 'pointer')
    .on('click', (event, d) => {
      clearTimeout(linkClickTimer);
      linkClickTimer = setTimeout(() => {
        const t = d.target;
        highlightPath(link, node, t);
        setHighlightedPath(t);
        if (typeof info !== 'undefined' && info) info.show(t);
      }, 220);
    });

  // 5) Nodes
  const node = gRoot.append('g')
    .selectAll('g')
    .data(root.descendants())
    .join('g')
    .attr('transform', d => `rotate(${(d.x * 180 / Math.PI - 90)}) translate(${d.y},0)`);

  node.append('circle')
    .attr('r', 2.2)
    .attr('fill', '#202124');

  node.append('text')
    .attr('dy', '0.32em')
    .attr('x', d => (d.x < Math.PI) === !d.children ? 6 : -6)
    .attr('text-anchor', d => (d.x < Math.PI) === !d.children ? 'start' : 'end')
    .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
    .text(d => d.data.name);

  // Recompute text orientation after rotation so labels don't appear upside-down
  function updateLabelOrientation() {
    const rotRad = (currentRotate * Math.PI) / 180;
    const tau = Math.PI * 2;
    function outward(d) { return ((d.x + rotRad) % tau + tau) % tau < Math.PI; }
    node.select('text')
      .attr('x', d => (outward(d) === !d.children ? 6 : -6))
      .attr('text-anchor', d => (outward(d) === !d.children ? 'start' : 'end'))
      .attr('transform', d => outward(d) ? null : 'rotate(180)');
  }

  // Angle-based label culling (avoid overlap at initial scale)
  const cull = applyAngleCulling(root, node, 0.9);
  const info = setupFocusInfo(node);
  const { showAt: showPopupAt } = createPopup('popup');

  // 6) Click/Double-click interactions

  let clickTimer = null;
  node.style('cursor', 'pointer')
    .on('click', (event, d) => {
      // delay to distinguish from dblclick
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        highlightPath(link, node, d);
        setHighlightedPath(d);
        if (info) info.show(d);
      }, 220);
    })
    .on('dblclick', (event, d) => {
      clearTimeout(clickTimer);
      // Build a path string to show (root -> node names)
      const names = d.ancestors().reverse().map(a => a.data.name).join(' / ');
      // Show popup with empty info section for now
      showPopupAt(event.pageX, event.pageY, d.data.name, '');
    });

  // 7) Rotation UI hookup (optional)
  const rotateInput = document.getElementById('rotate');
  const rotateValueEl = document.getElementById('rotateValue');
  function applyRotation(deg) {
    currentRotate = deg;
    updateRotate();
    updateLabelOrientation();
    if (rotateValueEl) rotateValueEl.textContent = `${deg}\u00B0`;
  }
  if (rotateInput) {
    applyRotation(Number(rotateInput.value || 0));
    rotateInput.addEventListener('input', (e) => applyRotation(Number(e.target.value)));
  }

  // 7.5) Search + focus
  setupSearch({
    root,
    link,
    node,
    info,
    setCurrentRotate: (value) => { currentRotate = value; },
    updateRotate,
    updateLabelOrientation
  });

  // 8) Zoom/pan (wheel/pinch)
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.3, 8])
    .on('zoom', (event) => {
      currentScale = event.transform.k;
      currentTranslateX = event.transform.x;
      currentTranslateY = event.transform.y;
      updateViewport();
      if (cull && cull.updateByScale) cull.updateByScale(event.transform.k);
    });
  svg.call(zoomBehavior).on('dblclick.zoom', null);

  // Buttons for zoom control
  const btnIn = document.getElementById('zoomIn');
  const btnOut = document.getElementById('zoomOut');
  const btnReset = document.getElementById('zoomReset');
  if (btnIn) btnIn.addEventListener('click', () => svg.transition().duration(150).call(zoomBehavior.scaleBy, 1.2));
  if (btnOut) btnOut.addEventListener('click', () => svg.transition().duration(150).call(zoomBehavior.scaleBy, 1/1.2));
  if (btnReset) btnReset.addEventListener('click', () => svg.transition().duration(150).call(zoomBehavior.transform, d3.zoomIdentity));

  // Initialize transforms
  updateViewport();
  updateRotate();
}

// Optional CSS to include in your page/app:
// .highlight { stroke: #e24a33 !important; stroke-width: 2.5px; fill: #e24a33; font-weight: 600; }

// Expose for index.html which calls renderMammalTree from a non-module script
// while still allowing ES module imports above.
// If running in a browser, attach to window for convenience.
if (typeof window !== 'undefined') {
  window.renderMammalTree = renderMammalTree;
}

export { renderMammalTree };