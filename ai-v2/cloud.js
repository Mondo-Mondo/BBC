(function () {
  const canvas = document.getElementById('cloudCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let DPR = 1;
  let particles = [];
  let targets = [];
  const mouse = { x: -1e9, y: -1e9 };

  const LINK_DIST = 95;
  const GOLD = '212,168,67';
  const GOLD_LIGHT = '232,200,90';

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    if (W === 0 || H === 0) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function build() {
    targets = sampleText();
    if (targets.length === 0) return;

    const count = Math.min(targets.length, prefersReduced ? 500 : 1300);
    particles = [];
    for (let i = 0; i < count; i++) {
      const t = targets[i % targets.length];
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        tx: t.x,
        ty: t.y,
        size: 0.8 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.4,
      });
    }
  }

  function sampleText() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const octx = off.getContext('2d');

    const fontSize = Math.min(W * 0.32, 240);
    octx.fillStyle = '#fff';
    octx.font = '900 ' + fontSize + 'px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText('AI', W / 2, H / 2 + 6);

    const data = octx.getImageData(0, 0, W, H).data;
    const step = Math.max(5, Math.floor(fontSize / 28));
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
      }
    }
    return pts;
  }

  function step(now) {
    const cell = LINK_DIST;
    const gx = Math.ceil(W / cell) || 1;
    const grid = new Map();

    particles.forEach((p) => {
      const kx = Math.floor(p.x / cell);
      const ky = Math.floor(p.y / cell);
      const k = kx + ky * gx;
      const bucket = grid.get(k);
      if (bucket) bucket.push(p);
      else grid.set(k, [p]);
    });

    for (const p of particles) {
      p.x += (p.tx - p.x) * 0.05;
      p.y += (p.ty - p.y) * 0.05;

      if (!prefersReduced) {
        const wobble = Math.sin(now * 0.0012 * p.speed + p.phase) * 0.4;
        p.x += Math.cos(p.phase) * wobble;
        p.y += Math.sin(p.phase) * wobble * 0.7;
      }

      const mdx = p.x - mouse.x;
      const mdy = p.y - mouse.y;
      const md2 = mdx * mdx + mdy * mdy;
      if (md2 < 150000) {
        const md = Math.sqrt(md2) || 1;
        const force = (400 - md) / 400;
        p.x += (mdx / md) * force * 3.2;
        p.y += (mdy / md) * force * 3.2;
      }
    }

    ctx.clearRect(0, 0, W, H);

    // connection lines
    ctx.lineWidth = 0.6;
    for (const p of particles) {
      const kx = Math.floor(p.x / cell);
      const ky = Math.floor(p.y / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const nb = grid.get(kx + ox + (ky + oy) * gx);
          if (!nb) continue;
          for (const q of nb) {
            if (q === p) continue;
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < LINK_DIST * LINK_DIST) {
              const a = (1 - Math.sqrt(d2) / LINK_DIST) * 0.16;
              ctx.strokeStyle = 'rgba(' + GOLD + ',' + a.toFixed(3) + ')';
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + GOLD_LIGHT + ',0.85)';
      ctx.fill();
    }

    // soft glow behind the word
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.45);
    glow.addColorStop(0, 'rgba(' + GOLD + ',0.10)');
    glow.addColorStop(1, 'rgba(' + GOLD + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function loop(now) {
    step(now);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  document.addEventListener('mouseleave', () => {
    mouse.x = -1e9;
    mouse.y = -1e9;
  });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    const r = canvas.getBoundingClientRect();
    mouse.x = t.clientX - r.left;
    mouse.y = t.clientY - r.top;
  }, { passive: true });

  resize();
  if (W === 0) {
    window.addEventListener('load', resize);
  }
  requestAnimationFrame(loop);
})();
