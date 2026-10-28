var ccEndingMotionSerial;

function ccEndingMotionSpec(source) {
  // Coordinates are fractions of each inspected original, never of the stage box.
  const masks = {
    'art/ending/legacy-growth.webp': ['water', [[.89,.47],[.985,.47],[.985,.58],[.90,.575]]],
    'art/ending/legacy-headquarters.webp': ['water', [[.49,.44],[.70,.44],[.76,.57],[.62,.66],[.38,.60]]],
    'art/ending/legacy-finance.webp': ['light', [[.31,.53],[.43,.56],[.40,.60],[.30,.56]]],
    'art/ending/legacy-customer.webp': ['light', [[.69,.71],[.76,.73],[.75,.78],[.68,.76]]],
    'art/ending/legacy-craft.webp': ['light', [[.18,.82],[.26,.85],[.24,.88],[.16,.85]]],
    'art/ending/legacy-recovery.webp': ['light', [[.61,.72],[.69,.74],[.65,.77],[.60,.76]]],
    'art/ending/office-complete.webp': ['light', [[.545,.55],[.59,.54],[.585,.56],[.535,.58]]],
    'art/ending/office-early.webp': ['light', [[.545,.55],[.59,.54],[.585,.56],[.535,.58]]],
    'art/strategy-office.png': ['light', [[.545,.55],[.59,.54],[.585,.56],[.535,.58]]],
    'art/strategy-map.png': ['water', [[.55,.82],[.70,.82],[.70,.93],[.55,.93]]],
    'art/opening/harbor.webp': ['water', [[.33,.46],[.48,.46],[.50,.64],[.37,.69],[.33,.61]]],
    'art/opening/factory.webp': ['light', [[.70,.80],[.75,.84],[.73,.87],[.69,.84]]],
  };
  return Object.hasOwn(masks, source) ? { kind: masks[source][0], points: masks[source][1] } : null;
}

function ccEndingMotionSource(image) { return image?.getAttribute('src') || image?.src; }
function ccEndingMotionNode(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function ccEndingMotionBind(stage, image, scene) {
  const source = ccEndingMotionSource(image), spec = ccEndingMotionSpec(source);
  const width = image?.naturalWidth, height = image?.naturalHeight;
  if (!spec || !image.complete || image.hidden || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const prefix = `cc-ending-motion-${ccEndingMotionSerial = (ccEndingMotionSerial || 0) + 1}`;
  const layer = ccEndingMotionNode('svg', { class: 'cc-ending-motion', viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
  const points = spec.points.map(([x, y]) => `${x * width},${y * height}`).join(' ');
  const defs = ccEndingMotionNode('defs', {}), clip = ccEndingMotionNode('clipPath', { id: prefix });
  clip.append(ccEndingMotionNode('polygon', { points })); defs.append(clip); layer.append(defs);
  const masked = ccEndingMotionNode('g', { 'clip-path': `url(#${prefix})` }); layer.append(masked);
  const parts = [];
  if (spec.kind === 'water') {
    for (let band = 0; band < 2; band++) {
      const stripes = ccEndingMotionNode('clipPath', { id: `${prefix}-${band}` });
      for (let y = band * 8; y < height; y += 16) stripes.append(ccEndingMotionNode('rect', { x: 0, y, width, height: 6 }));
      defs.append(stripes);
      const strip = ccEndingMotionNode('g', { 'clip-path': `url(#${prefix}-${band})` }); masked.append(strip);
      const part = ccEndingMotionNode('image', { href: source, width, height, opacity: .45, 'data-ending-motion': `water-${band}` });
      strip.append(part); parts.push(part);
    }
  } else {
    const part = ccEndingMotionNode('polygon', { points, class: 'cc-ending-reflection', opacity: 0, 'data-ending-motion': 'light' });
    masked.append(part); parts.push(part);
  }
  stage.append(layer);
  return { layer, image, source, scene: scene.id, parts, frame: -1, removed: false,
    reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false } };
}

function ccEndingMotionPaint(motion, status) {
  if (!motion || motion.removed) return;
  const disabled = (typeof motionOff === 'function' && motionOff()) || motion.reduced.matches ||
    !motion.image.complete || !motion.image.naturalWidth || motion.image.hidden ||
    ccEndingMotionSource(motion.image) !== motion.source || status?.state === 'error';
  if (motion.disabled !== disabled) {
    motion.disabled = disabled;
    motion.layer.style.visibility = disabled ? 'hidden' : 'visible';
  }
  if (disabled || document.hidden || status?.state !== 'playing' || !Number.isFinite(status.position) || status.position < 0) return;
  const frame = Math.floor(status.position * 8);
  if (frame === motion.frame) return;
  motion.frame = frame;
  const wave = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1][frame % 12];
  for (const part of motion.parts) {
    const kind = part.getAttribute('data-ending-motion');
    if (kind === 'light') part.setAttribute('opacity', String(.024 + wave * .002));
    else part.setAttribute('transform', `translate(${kind === 'water-0' ? wave : -wave} ${frame % 4 < 2 ? 0 : 1})`);
  }
}

function ccEndingMotionRemove(state) {
  if (!state.motion) return;
  state.motion.removed = true;
  state.motion.layer.remove();
  state.motion = null;
}
