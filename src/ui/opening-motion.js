function ccOpeningMotionMarkup(scene) {
  const water = scene.id === 'harbor' ?
    'M 510 453 L 755 440 L 802 470 L 805 535 L 830 574 L 920 614 L 990 657 L 995 724 L 725 742 L 582 705 L 515 634 Z' :
    ['route', 'title'].includes(scene.id) ?
      'M 816 785 L 985 795 L 1120 790 L 1325 751 L 1415 718 L 1435 760 L 1285 819 L 1172 869 L 1155 931 L 1020 968 L 875 961 L 824 916 L 741 895 L 748 874 L 832 837 Z M 1340 945 L 1478 930 L 1586 940 L 1586 992 L 1335 992 Z' : '';
  if (!water && scene.id !== 'factory') return '';
  const prefix = `cc-opening-motion-${scene.id}`;
  const image = `<image href="art/${scene.art}" width="1586" height="992"/>`;
  let content;
  if (water) {
    const bands = offset => Array.from({ length: 44 }, (_, index) =>
      `<rect x="0" y="${288 + index * 16 + offset}" width="1586" height="7"/>`).join('');
    content = `<defs><clipPath id="${prefix}-water"><path d="${water}"/></clipPath>
      <clipPath id="${prefix}-a">${bands(0)}</clipPath><clipPath id="${prefix}-b">${bands(8)}</clipPath></defs>
      <g clip-path="url(#${prefix}-water)">
        <g clip-path="url(#${prefix}-a)"><g data-opening-motion="water-a" opacity=".72">${image}</g></g>
        <g clip-path="url(#${prefix}-b)"><g data-opening-motion="water-b" opacity=".64">${image}</g></g>
      </g>`;
  } else {
    content = `<defs>
      <clipPath id="${prefix}-roller"><path d="M 985 365 L 1104 365 L 1112 395 L 990 394 Z M 1200 488 L 1382 486 L 1385 500 L 1200 502 Z"/></clipPath>
      <clipPath id="${prefix}-sheet"><path d="M 1014 420 L 1113 420 L 1227 462 L 1118 458 Z"/></clipPath>
      </defs>
      <g clip-path="url(#${prefix}-roller)"><g data-opening-motion="roller" opacity=".8">${image}
        <path class="cc-opening-metal-light" d="M 984 373 h 128 v 2 H 984 Z M 1198 489 h 188 v 2 H 1198 Z"/>
        <path class="cc-opening-metal-dark" d="M 984 384 h 128 v 2 H 984 Z M 1198 496 h 188 v 1 H 1198 Z"/>
      </g></g>
      <g clip-path="url(#${prefix}-sheet)"><g data-opening-motion="sheet" opacity=".55">${image}
        <path class="cc-opening-metal-light" d="M 1008 425 h 106 l 6 2 H 1014 Z M 1052 443 h 120 l 6 2 H 1058 Z"/>
      </g></g>`;
  }
  return `<svg class="cc-opening-motion" viewBox="0 0 1586 992" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${content}</svg>`;
}

function ccOpeningMotionBind(stage, image) {
  const layer = stage.querySelector('.cc-opening-motion');
  if (!layer) return null;
  return { layer, image, parts: [...layer.querySelectorAll('[data-opening-motion]')], frame: -1,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)') };
}

function ccOpeningMotionPaint(motion, status) {
  if (!motion) return;
  const disabled = motionOff() || motion.reduced.matches || !motion.image?.complete || !motion.image.naturalWidth;
  if (motion.disabled !== disabled) {
    motion.disabled = disabled;
    motion.layer.style.visibility = disabled ? 'hidden' : 'visible';
  }
  if (disabled || document.hidden || status.state !== 'playing') return;
  const frame = Math.floor(status.position * 8);
  if (frame === motion.frame) return;
  motion.frame = frame;
  const wave = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1][frame % 12];
  for (const part of motion.parts) {
    const kind = part.dataset.openingMotion;
    const [x, y] = kind === 'water-a' ? [wave, frame % 4 < 2 ? 0 : 1]
      : kind === 'water-b' ? [-wave, frame % 4 < 2 ? 1 : 0]
      : kind === 'roller' ? [0, frame % 6 - 2]
      : [frame % 8, (frame % 8) / 4];
    part.setAttribute('transform', `translate(${x} ${y})`);
  }
}

function ccOpeningMotionRemove(state) {
  state.motion?.layer.remove();
  state.motion = null;
}
