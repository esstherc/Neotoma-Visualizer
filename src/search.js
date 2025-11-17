// Search functionality for the radial tree visualization
// Supports synonym search - searches both valid and invalid taxonomic names
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

import { 
  getAllSynonymIds, 
  getAllSynonymNames, 
  isInvalidId,
  getSynonymInfo,
  isSynonymsReady 
} from './synonyms.js';
import { setHighlightedPath, clearHighlightedPath, setMatchIds } from './viewSwitch.js';

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
  let primaryMatchIds = new Set(); // IDs that directly matched the search query
  let synonymMatchIds = new Set(); // IDs that matched through synonym relationships
  
  function focusNode(d) {
    setCurrentRotate(90 - (d.x * 180 / Math.PI));
    updateRotate();
    updateLabelOrientation();
    const A = new Set(d.ancestors());
    link.classed('highlight', l => A.has(l.source) && A.has(l.target));
    node.select('text').classed('highlight', n => A.has(n));
    setHighlightedPath(d);
    if (info) info.show(d);
  }
  
  function highlightAllMatches(matches) {
    // Clear previous highlights
    link.classed('highlight', false);
    link.classed('highlight-synonym', false);
    node.select('text').classed('highlight', false);
    node.select('text').classed('highlight-synonym', false);
    
    if (matches.length === 0) return;
    
    // Collect all ancestors for primary and synonym matches separately
    const primaryAncestors = new Set();
    const synonymAncestors = new Set();
    
    // First pass: collect primary ancestors
    matches.forEach(m => {
      if (primaryMatchIds.has(m.data.id)) {
        m.ancestors().forEach(a => primaryAncestors.add(a));
      }
    });
    
    // Second pass: collect synonym ancestors (including shared ones)
    matches.forEach(m => {
      if (synonymMatchIds.has(m.data.id)) {
        m.ancestors().forEach(a => synonymAncestors.add(a));
      }
    });
    
    // Highlight links
    // A link gets primary highlight if both nodes are in primary path
    // A link gets synonym highlight if both nodes are in synonym path but NOT both in primary path
    link.classed('highlight', l => 
      primaryAncestors.has(l.source) && primaryAncestors.has(l.target)
    );
    link.classed('highlight-synonym', l => {
      const inSynonym = synonymAncestors.has(l.source) && synonymAncestors.has(l.target);
      const inPrimary = primaryAncestors.has(l.source) && primaryAncestors.has(l.target);
      return inSynonym && !inPrimary;
    });
    
    // Highlight text nodes
    node.select('text').classed('highlight', d => primaryMatchIds.has(d.data.id));
    node.select('text').classed('highlight-synonym', d => synonymMatchIds.has(d.data.id));
  }
  
  function showSearchResultsList() {
    // Show the list of all search results
    isShowingDetails = false;
    const panel = document.getElementById('info');
    if (!panel || currentMatches.length === 0) return;
    
    highlightAllMatches(currentMatches);
    
    const matchList = currentMatches.map((m, idx) => {
      const path = m.ancestors().reverse().map(n => n.data.name).join(' / ');
      
      // Add synonym badge if this is an invalid/synonym name
      let synonymBadge = '';
      if (isSynonymsReady() && isInvalidId(m.data.id)) {
        const synonymInfo = getSynonymInfo(m.data.id);
        if (synonymInfo) {
          synonymBadge = `<span style="
            margin-left: 6px;
            padding: 2px 6px;
            background: #fef3c7;
            color: #92400e;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          ">synonym of ${synonymInfo.validName}</span>`;
        }
      }
      
      return `<div style="cursor:pointer;padding:6px 0;border-bottom:1px solid #e5e7eb;" data-index="${idx}" class="search-result-item">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div>${path}</div>
          ${synonymBadge ? `<div style="font-size:12px;">${synonymBadge}</div>` : ''}
        </div>
      </div>`;
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
    
    // Build synonym information section with type and date
    let synonymSection = '';
    if (isSynonymsReady()) {
      const synonymInfo = getSynonymInfo(selectedNode.data.id);
      if (synonymInfo) {
        const isInvalid = isInvalidId(selectedNode.data.id);
        const allNames = getAllSynonymNames(selectedNode.data.id);
        
        // Helper function to format date (only show date, not time)
        const formatDate = (dateStr) => {
          if (!dateStr) return 'N/A';
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        };
        
        if (allNames.size > 1 || isInvalid) {
          // This taxon has synonyms or is itself a synonym
          const otherNames = Array.from(allNames).filter(name => 
            name.toLowerCase() !== selectedNode.data.name.toLowerCase()
          );
          
          // Check which synonyms are actually in the tree
          const synonymsInTree = [];
          const synonymsNotInTree = [];
          synonymInfo.synonyms.forEach(syn => {
            const synDetails = {
              ...syn,
              inTree: idToNode.has(syn.invalid_id)
            };
            if (synDetails.inTree) {
              synonymsInTree.push(synDetails);
            } else {
              synonymsNotInTree.push(synDetails);
            }
          });
          
          // Find synonym details for the current node if it's invalid
          let currentSynonymDetails = null;
          if (isInvalid) {
            const currentId = selectedNode.data.id;
            currentSynonymDetails = synonymInfo.synonyms.find(syn => 
              syn.invalid_id === currentId
            );
          }
          
          synonymSection = `
            <div style="
              margin-top: 12px;
              padding: 10px;
              background: #f9fafb;
              border-left: 3px solid ${isInvalid ? '#f59e0b' : '#43a047'};
              border-radius: 4px;
            ">
              ${isInvalid && currentSynonymDetails ? `
                <div style="
                  margin-bottom: 10px;
                  padding: 8px;
                  background: #fef3c7;
                  border-radius: 4px;
                ">
                  <div style="font-weight:600;font-size:14px;color:#92400e;margin-bottom:4px;">
                    This is a synonym (invalid name)
                  </div>
                  <div style="font-size:13px;color:#78350f;margin-bottom:2px;">
                    <strong>Type:</strong> ${currentSynonymDetails.synonymtype || 'N/A'}
                  </div>
                  <div style="font-size:13px;color:#78350f;">
                    <strong>Record Modification Date:</strong> ${formatDate(currentSynonymDetails.recdatemodified)}
                  </div>
                </div>
              ` : ''}
              
              <div style="font-weight:600;font-size:15px;margin-bottom:6px;color:#1f2937;">
                ${isInvalid ? 'Valid Name:' : 'Synonyms:'}
              </div>
              
              ${isInvalid ? 
                `<div style="font-size:15px;color:#059669;font-weight:600;margin-bottom:4px;">
                  ${synonymInfo.validName}
                </div>
                ${synonymsInTree.length > 0 || synonymsNotInTree.length > 1 ? 
                  '<div style="font-size:14px;color:#6b7280;margin-top:6px;">Other synonyms:</div>' : ''}
                ${synonymsInTree.filter(s => s.invalid_id !== selectedNode.data.id).length > 0 ? `
                  <div style="font-size:14px;color:#6b7280;">
                    ${synonymsInTree.filter(s => s.invalid_id !== selectedNode.data.id).map(synDetails => `
                      <div style="padding:4px 0;border-top:1px solid #e5e7eb;margin-top:4px;">
                        <div style="font-weight:600;color:#f59e0b;">• ${synDetails.invalid_name} <span style="font-size:11px;color:#dc2626;">invalid name</span></div>
                        <div style="font-size:12px;color:#9ca3af;margin-left:12px;margin-top:2px;">
                          Type: ${synDetails.synonymtype || 'N/A'}
                        </div>
                        <div style="font-size:12px;color:#9ca3af;margin-left:12px;">
                          Modified: ${formatDate(synDetails.recdatemodified)}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${synonymsNotInTree.filter(s => s.invalid_id !== selectedNode.data.id).length > 0 ? `
                  <div style="font-size:14px;color:#9ca3af;margin-top:8px;">
                    <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Not in current tree:</div>
                    ${synonymsNotInTree.filter(s => s.invalid_id !== selectedNode.data.id).map(synDetails => `
                      <div style="padding:4px 0;border-top:1px solid #e5e7eb;margin-top:4px;opacity:0.7;">
                        <div style="font-weight:600;">• ${synDetails.invalid_name} <span style="font-size:11px;">⚠️ not rendered</span></div>
                        <div style="font-size:12px;color:#9ca3af;margin-left:12px;margin-top:2px;">
                          Type: ${synDetails.synonymtype || 'N/A'}
                        </div>
                        <div style="font-size:12px;color:#9ca3af;margin-left:12px;">
                          Modified: ${formatDate(synDetails.recdatemodified)}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}` 
                : ''}
              
              ${synonymsInTree.length > 0 && !isInvalid ? `
                <div style="font-size:14px;color:#6b7280;">
                  ${synonymsInTree.map(synDetails => `
                    <div style="padding:4px 0;border-top:1px solid #e5e7eb;margin-top:4px;">
                      <div style="font-weight:600;color:#f59e0b;">• ${synDetails.invalid_name} <span style="font-size:11px;color:#dc2626;">invalid name</span></div>
                      <div style="font-size:12px;color:#9ca3af;margin-left:12px;margin-top:2px;">
                        Type: ${synDetails.synonymtype || 'N/A'}
                      </div>
                      <div style="font-size:12px;color:#9ca3af;margin-left:12px;">
                        Modified: ${formatDate(synDetails.recdatemodified)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${synonymsNotInTree.length > 0 && !isInvalid ? `
                <div style="font-size:14px;color:#9ca3af;margin-top:8px;">
                  <div style="font-size:13px;font-weight:600;margin-bottom:4px;">Not in current tree:</div>
                  ${synonymsNotInTree.map(synDetails => `
                    <div style="padding:4px 0;border-top:1px solid #e5e7eb;margin-top:4px;opacity:0.7;">
                      <div style="font-weight:600;">• ${synDetails.invalid_name} <span style="font-size:11px;">⚠️ not rendered</span></div>
                      <div style="font-size:12px;color:#9ca3af;margin-left:12px;margin-top:2px;">
                        Type: ${synDetails.synonymtype || 'N/A'}
                      </div>
                      <div style="font-size:12px;color:#9ca3af;margin-left:12px;">
                        Modified: ${formatDate(synDetails.recdatemodified)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }
      }
    }
    
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
      ${synonymSection}
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
      primaryMatchIds = new Set();
      synonymMatchIds = new Set();
      link.classed('highlight', false);
      link.classed('highlight-synonym', false);
      node.select('text').classed('highlight', false);
      node.select('text').classed('highlight-synonym', false);
      clearHighlightedPath();
      return;
    }
    
    let matches = [];
    const matchedIds = new Set(); // Track matched node IDs to avoid duplicates
    primaryMatchIds = new Set(); // Reset primary matches
    synonymMatchIds = new Set(); // Reset synonym matches
    
    const id = Number(q);
    if (!Number.isNaN(id) && idToNode.has(id)) {
      // Exact ID match - check for synonyms if available
      primaryMatchIds.add(id); // The searched ID is primary
      
      if (isSynonymsReady()) {
        const allSynonymIds = getAllSynonymIds(id);
        allSynonymIds.forEach(synId => {
          if (idToNode.has(synId) && !matchedIds.has(synId)) {
            matches.push(idToNode.get(synId));
            matchedIds.add(synId);
            // Mark as synonym if it's not the original ID
            if (synId !== id) {
              synonymMatchIds.add(synId);
            }
          }
        });
      } else {
        // Fallback if synonyms not loaded
        matches = [idToNode.get(id)];
        matchedIds.add(id);
      }
    } else {
      // Fuzzy name search - find all matches including synonyms
      const lower = q.toLowerCase();
      
      // First pass: direct name matches
      const directMatches = root.descendants().filter(n => 
        (n.data.name || '').toLowerCase().includes(lower)
      );
      
      // Add direct matches as primary
      directMatches.forEach(n => {
        if (!matchedIds.has(n.data.id)) {
          matches.push(n);
          matchedIds.add(n.data.id);
          primaryMatchIds.add(n.data.id);
        }
      });
      
      // Second pass: check synonyms if available
      if (isSynonymsReady()) {
        // Track which nodes match through synonym names
        const synonymNameMatches = new Set();
        
        // Check if any synonym names match the search term
        root.descendants().forEach(n => {
          if (matchedIds.has(n.data.id)) return; // Already matched as primary
          
          const allSynonymNames = getAllSynonymNames(n.data.id);
          const hasMatchingSynonym = Array.from(allSynonymNames).some(name => 
            name.toLowerCase().includes(lower)
          );
          
          if (hasMatchingSynonym) {
            synonymNameMatches.add(n.data.id);
          }
        });
        
        // Add all related synonym IDs
        const allPrimaryIds = new Set(primaryMatchIds);
        allPrimaryIds.forEach(primaryId => {
          const allSynonymIds = getAllSynonymIds(primaryId);
          allSynonymIds.forEach(synId => {
            if (idToNode.has(synId) && !matchedIds.has(synId)) {
              matches.push(idToNode.get(synId));
              matchedIds.add(synId);
              // Only mark as synonym if it's not already a primary match
              if (!primaryMatchIds.has(synId)) {
                synonymMatchIds.add(synId);
              }
            }
          });
        });
        
        // Add nodes matched through synonym names
        synonymNameMatches.forEach(nodeId => {
          const allSynonymIds = getAllSynonymIds(nodeId);
          allSynonymIds.forEach(synId => {
            if (idToNode.has(synId) && !matchedIds.has(synId)) {
              matches.push(idToNode.get(synId));
              matchedIds.add(synId);
              // If this ID matches the search in its synonym name, mark as primary
              const allNames = getAllSynonymNames(synId);
              const matchesDirectly = Array.from(allNames).some(name => 
                name.toLowerCase().includes(lower)
              );
              if (matchesDirectly) {
                primaryMatchIds.add(synId);
              } else {
                synonymMatchIds.add(synId);
              }
            }
          });
        });
      }
    }
    
    currentMatches = matches;
    currentMatchIndex = -1;
    
    // Set match IDs for Focus View
    const allMatchIds = new Set([...primaryMatchIds, ...synonymMatchIds]);
    setMatchIds(allMatchIds);
    
    // Debug: log the classification of matches and check for synonyms not in tree
    console.log('Search results for:', q);
    console.log('Primary match IDs:', Array.from(primaryMatchIds));
    console.log('Synonym match IDs:', Array.from(synonymMatchIds));
    console.log('Total matches:', matches.length);
    matches.forEach(m => {
      const type = primaryMatchIds.has(m.data.id) ? 'PRIMARY' : 
                   synonymMatchIds.has(m.data.id) ? 'SYNONYM' : 'UNKNOWN';
      console.log(`  - ${m.data.name} (ID: ${m.data.id}) [${type}]`);
    });
    
    // Check if there are synonyms that exist in the synonym database but not in the current tree
    if (isSynonymsReady() && (primaryMatchIds.size > 0 || synonymMatchIds.size > 0)) {
      const allCheckedIds = new Set([...primaryMatchIds, ...synonymMatchIds]);
      allCheckedIds.forEach(matchId => {
        const synonymInfo = getSynonymInfo(matchId);
        if (synonymInfo) {
          const allSynonymIds = getAllSynonymIds(matchId);
          const allSynonymNames = getAllSynonymNames(matchId);
          const missingInTree = [];
          
          // Check each synonym ID
          synonymInfo.synonyms.forEach(syn => {
            if (!idToNode.has(syn.invalid_id)) {
              missingInTree.push({ 
                id: syn.invalid_id, 
                name: syn.invalid_name,
                type: syn.synonymtype 
              });
            }
          });
          
          if (missingInTree.length > 0) {
            console.log(`⚠️ Synonyms of "${synonymInfo.validName}" (ID: ${synonymInfo.validId}) not in current tree:`, missingInTree);
          }
        }
      });
    }
    
    if (matches.length === 0) {
      if (info) {
        const panel = document.getElementById('info');
        if (panel) {
          panel.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">Search Results</div><div style="color:#6b7280;">No matches found for "${q}"</div>`;
          panel.style.display = 'block';
        }
      }
      highlightAllMatches([]);
      clearHighlightedPath();
    } else if (matches.length === 1) {
      // Single match - focus directly and show details
      isShowingDetails = true;
      focusNode(matches[0]);
      showNodeDetails(matches[0]);
      // setHighlightedPath is called in focusNode
    } else {
      // Multiple matches - show list
      // Set highlighted path to first match so Focus View can work
      setHighlightedPath(matches[0]);
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
        primaryMatchIds = new Set();
        synonymMatchIds = new Set();
        link.classed('highlight', false);
        link.classed('highlight-synonym', false);
        node.select('text').classed('highlight', false);
        node.select('text').classed('highlight-synonym', false);
        clearHighlightedPath();
        if (info) info.clear();
      }
    });
  }
}

