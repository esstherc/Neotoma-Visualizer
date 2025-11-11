// Data transformations: parse exported paths, normalize rows, and build hierarchy

function parseIdPath(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string') return [];
  const s = value.trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).map(Number); } catch { return []; } }
  if (s.startsWith('{') && s.endsWith('}')) {
    const tokens = s.slice(1, -1).split(',').map(t => t.trim()).filter(Boolean);
    const result = [];
    let acc = '';
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].replace(/[^0-9]/g, '');
      if (!t) continue;
      if (acc.length + t.length <= 5) acc += t; else { if (acc) result.push(Number(acc)); acc = t; }
      if (acc.length >= 4) {
        const next = tokens[i + 1] ? tokens[i + 1].replace(/[^0-9]/g, '') : '';
        if (!next || acc.length === 5 || (acc.length === 4 && next.length > 1)) { result.push(Number(acc)); acc = ''; }
      }
    }
    if (acc) result.push(Number(acc));
    return result;
  }
  return [];
}

function parseNamePath(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  const s = value.trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).map(String); } catch { return []; } }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1);
    const parts = [];
    let curr = '';
    let inQ = false;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '"') { inQ = !inQ; curr += ch; continue; }
      if (ch === ',' && !inQ) { parts.push(curr); curr = ''; continue; }
      curr += ch;
    }
    if (curr) parts.push(curr);
    return parts.map(p => {
      const t = p.trim();
      if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
      return t;
    });
  }
  return [];
}

export function normalizeRows(rows) {
  return rows.map(r => ({
    ...r,
    ids_root_to_leaf: parseIdPath(r.ids_root_to_leaf),
    names_root_to_leaf: parseNamePath(r.names_root_to_leaf),
  }));
}

export function pathsToTree(rows, rootId = 6171, rootName = 'Mammalia') {
  const root = { id: rootId, name: rootName, children: [] };
  const byId = new Map([[root.id, root]]);
  const nameDict = new Map();
  for (const r of rows) {
    r.ids_root_to_leaf.forEach((id, i) => {
      const nm = r.names_root_to_leaf[i];
      if (id != null && nm && !nameDict.has(id)) nameDict.set(id, nm);
    });
  }
  for (const r of rows) {
    const ids = r.ids_root_to_leaf;
    const names = r.names_root_to_leaf;
    if (ids[0] !== root.id) continue;
    let parent = root;
    for (let i = 1; i < ids.length; i++) {
      const id = ids[i];
      const name = names[i] ?? nameDict.get(id) ?? String(id);
      let child = byId.get(id);
      if (!child) {
        child = { id, name, children: [] };
        byId.set(id, child);
        (parent.children || (parent.children = [])).push(child);
      }
      parent = child;
    }
  }
  (function prune(n) { if (n.children && n.children.length) n.children.forEach(prune); else delete n.children; })(root);
  return root;
}


