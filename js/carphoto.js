// "Try on your car": the customer picks a photo of their car, lines a ring up
// with each wheel, and the configured wheel is drawn into place. It all runs
// in the browser; the photo is never uploaded.

const MAX_SIDE = 2400;    // longest side of the working image, in pixels
const MIN_ASPECT = 0.3;   // narrowest ring, as width / height (about 72 degrees turned)
const CACHE_SIZE = 24;    // rendered wheel images kept for reuse

export function initCarPhoto({ renderWheelImage, wheels, version, toast }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('carDialog');
  const canvas = $('carCanvas');
  const g = canvas.getContext('2d');
  const ringsEl = $('carRings');

  let photo = null;
  let rings = [];          // { x, y, h, aspect }: centre and height in canvas pixels, width / height
  let swapped = false;     // ring 0 shows the rear wheel instead of the front
  let showOriginal = false;
  let queued = false;
  const cache = new Map(); // rendered wheels, keyed by axle, angle and size
  let cacheVersion = '';

  const wheelFor = (i) => wheels()[swapped ? 1 - i : i];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------- opening and loading ----------

  function open() {
    if (version() !== cacheVersion) { cache.clear(); cacheVersion = version(); }
    const staggered = wheels()[0].axle !== wheels()[1].axle;
    $('carSwap').hidden = !staggered;
    if (!staggered) swapped = false;
    dialog.showModal();
    if (photo) { buildRings(); layout(); draw(); }
  }

  function load(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast("That file isn't an image. Choose a JPEG or PNG photo.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      photo = img;
      // Start where the wheels usually are in a side-on photo
      const h = Math.min(canvas.width * 0.2, canvas.height * 0.36);
      rings = [
        { x: canvas.width * 0.24, y: canvas.height * 0.66, h, aspect: 0.92 },
        { x: canvas.width * 0.76, y: canvas.height * 0.66, h, aspect: 0.92 },
      ];
      $('carDrop').hidden = true;
      $('carStage').hidden = false;
      $('carFoot').hidden = false;
      buildRings();
      layout();
      draw();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast("That photo couldn't be opened. Try a JPEG or PNG.");
    };
    img.src = url;
  }

  // ---------- rings ----------

  function buildRings() {
    ringsEl.innerHTML = rings.map((_, i) => {
      const label = wheelFor(i).label;
      return `<div class="car-ring" data-i="${i}" tabindex="0" role="group"
        aria-label="${label} wheel ring. Arrow keys move it, plus and minus resize it, square brackets change the angle.">
        <span class="car-ring-label">${label}</span>
        <span class="car-handle car-handle-size" data-handle="size" aria-hidden="true"></span>
        <span class="car-handle car-handle-angle" data-handle="angle" aria-hidden="true"></span>
      </div>`;
    }).join('');
  }

  // Position the ring elements over the canvas, which CSS scales to fit
  function layout() {
    if (!photo) return;
    const s = canvas.clientWidth / canvas.width;
    Object.assign(ringsEl.style, {
      left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
      width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`,
    });
    ringsEl.querySelectorAll('.car-ring').forEach((el, i) => {
      const r = rings[i];
      const w = r.h * r.aspect;
      Object.assign(el.style, {
        left: `${(r.x - w / 2) * s}px`, top: `${(r.y - r.h / 2) * s}px`,
        width: `${w * s}px`, height: `${r.h * s}px`,
      });
    });
  }

  function update() { layout(); draw(); }

  ringsEl.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.car-ring'); if (!el) return;
    e.preventDefault();
    el.focus();
    const i = Number(el.dataset.i);
    const mode = e.target.dataset.handle || 'move';
    const start = { px: e.clientX, py: e.clientY, ...rings[i] };
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const k = canvas.width / canvas.clientWidth;
      const dx = (ev.clientX - start.px) * k, dy = (ev.clientY - start.py) * k;
      const r = rings[i];
      if (mode === 'move') {
        r.x = clamp(start.x + dx, 0, canvas.width);
        r.y = clamp(start.y + dy, 0, canvas.height);
      } else if (mode === 'size') {
        // The handle sits on the corner, so it moves half as far as the ring grows
        r.h = clamp(start.h + dy + dx / start.aspect, 24, canvas.height * 1.2);
      } else {
        r.aspect = clamp((start.h * start.aspect + 2 * dx) / start.h, MIN_ASPECT, 1);
      }
      update();
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });

  ringsEl.addEventListener('keydown', (e) => {
    const el = e.target.closest('.car-ring'); if (!el) return;
    const r = rings[Number(el.dataset.i)];
    const step = canvas.width * (e.shiftKey ? 0.05 : 0.005);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      r.x = clamp(r.x + moves[e.key][0] * step, 0, canvas.width);
      r.y = clamp(r.y + moves[e.key][1] * step, 0, canvas.height);
    } else if (e.key === '+' || e.key === '=') r.h = clamp(r.h * 1.03, 24, canvas.height * 1.2);
    else if (e.key === '-') r.h = clamp(r.h / 1.03, 24, canvas.height * 1.2);
    else if (e.key === ']') r.aspect = clamp(r.aspect + 0.02, MIN_ASPECT, 1);
    else if (e.key === '[') r.aspect = clamp(r.aspect - 0.02, MIN_ASPECT, 1);
    else return;
    e.preventDefault();
    update();
  });

  // ---------- drawing ----------

  // The ring's shape gives the angle the wheel is seen from: a circle is
  // face-on, a narrower ellipse is turned further away.
  function wheelImage(axle, aspect, h) {
    const deg = Math.round((Math.acos(clamp(aspect, 0, 1)) * 180) / Math.PI);
    const px = clamp(Math.ceil(h / 64) * 64, 128, 1024);
    const key = `${axle}|${deg}|${px}`;
    if (!cache.has(key)) {
      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value);
      cache.set(key, renderWheelImage(axle, (deg * Math.PI) / 180, px));
    }
    return cache.get(key);
  }

  function draw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }

  function paint() {
    if (!photo) return;
    g.drawImage(photo, 0, 0, canvas.width, canvas.height);
    if (showOriginal) return;
    rings.forEach((r, i) => {
      const rx = (r.h * r.aspect) / 2, ry = r.h / 2;
      g.save();
      g.beginPath();
      g.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      g.clip();
      // Dark backing hides the original wheel between the new spokes
      g.translate(r.x, r.y);
      g.scale(r.aspect, 1);
      const shade = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      shade.addColorStop(0, '#2a2d32');
      shade.addColorStop(0.6, '#141518');
      shade.addColorStop(1, '#08090a');
      g.fillStyle = shade;
      g.fillRect(-ry, -ry, r.h, r.h);
      // A hint of brake disc
      g.strokeStyle = 'rgba(130, 134, 140, 0.22)';
      g.lineWidth = r.h * 0.06;
      g.beginPath();
      g.arc(0, 0, r.h * 0.31, 0, Math.PI * 2);
      g.stroke();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(wheelImage(wheelFor(i).axle, r.aspect, r.h), r.x - ry, r.y - ry, r.h, r.h);
      g.restore();
    });
  }

  function save() {
    const was = showOriginal;
    showOriginal = false;
    paint();
    canvas.toBlob((blob) => {
      if (!blob) { toast("The image couldn't be saved."); return; }
      const a = document.createElement('a');
      a.download = 'hart-forged-on-your-car.jpg';
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Image saved');
    }, 'image/jpeg', 0.92);
    showOriginal = was;
    paint();
  }

  // ---------- controls ----------

  $('carClose').addEventListener('click', () => dialog.close());
  $('carFile').addEventListener('change', (e) => { load(e.target.files[0]); e.target.value = ''; });
  $('carChange').addEventListener('click', () => $('carFile').click());
  $('carSave').addEventListener('click', save);
  $('carSwap').addEventListener('click', () => { swapped = !swapped; buildRings(); update(); });
  $('carOriginal').addEventListener('click', () => {
    showOriginal = !showOriginal;
    $('carOriginal').setAttribute('aria-pressed', String(showOriginal));
    ringsEl.hidden = showOriginal;
    draw();
  });

  dialog.addEventListener('dragover', (e) => { e.preventDefault(); $('carDrop').classList.add('is-over'); });
  dialog.addEventListener('dragleave', () => $('carDrop').classList.remove('is-over'));
  dialog.addEventListener('drop', (e) => {
    e.preventDefault();
    $('carDrop').classList.remove('is-over');
    load(e.dataTransfer.files[0]);
  });

  new ResizeObserver(layout).observe($('carStage'));

  return { open };
}
