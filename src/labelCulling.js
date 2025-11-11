export function applyAngleCulling(root, node, minDeg = 0.9) {
  let threshold = (minDeg * Math.PI) / 180;
  const leaves = root.leaves().slice().sort((a,b)=>a.x-b.x);
  const visible = new Set();
  function recompute() {
    visible.clear();
    for (let i=0;i<leaves.length;i++){
      const prev = leaves[(i-1+leaves.length)%leaves.length];
      const next = leaves[(i+1)%leaves.length];
      const dθ = Math.min(Math.abs(leaves[i].x - prev.x), Math.abs(next.x - leaves[i].x));
      if (dθ >= threshold) visible.add(leaves[i]);
    }
    node.select('text')
      .style('display', d => d.children ? 'none' : (visible.has(d) ? 'block' : 'none'));
  }
  function updateByScale(k) {
    // 放大时逐步显示更多文字
    const base = (minDeg * Math.PI) / 180;
    threshold = base / Math.max(1, Math.sqrt(k));
    recompute();
  }
  recompute();
  return { updateByScale };
}



