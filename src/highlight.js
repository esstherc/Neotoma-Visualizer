// Highlight utilities for path and nodes
export function highlightPath(linkSel, nodeSel, focusNode) {
  const A = new Set(focusNode.ancestors());
  linkSel.classed('highlight', l => A.has(l.source) && A.has(l.target));
  nodeSel.selectAll('text').classed('highlight', n => A.has(n));
}


