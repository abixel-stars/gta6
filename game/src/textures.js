// Procedural textures for Solmar v2: every big surface gets a painted canvas
// texture instead of a flat color — asphalt, pavers, brick, plaster, glass,
// grass, sand, water, roofs, signs and awnings. All drawn in code at run
// time, so the game still ships no image files and loads nothing.
import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, w, h, n, colors, size) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

// Asphalt with worn patches, cracks and the road markings v1 already had:
// edge lines along the road and a dashed center line.
export function makeRoadTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2b2e33';
    speckle(g, 128, 128, 220, ['#2b2e33', '#3a3d42', '#26282c'], 2);
    // Worn darker patches.
    g.fillStyle = 'rgba(20,22,25,0.35)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 12 + Math.random() * 18, 8 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Thin cracks.
    g.strokeStyle = 'rgba(15,16,18,0.7)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = Math.random() * 128;
      let y = Math.random() * 128;
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 22;
        y += (Math.random() - 0.5) * 22;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Edge lines run along the road: horizontal in canvas space (constant V).
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 5, 128, 3);
    g.fillRect(0, 120, 128, 3);
    // Center dashes: horizontal at the middle, dashed along the road (U).
    g.fillStyle = '#e8d44d';
    g.fillRect(0, 62, 44, 4);
    g.fillRect(84, 62, 44, 4);
  });
}

// Paver sidewalk: square tiles with joints, speckle and a few stains.
export function makeSidewalkTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#b9b3a4';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 300, ['#a9a394', '#c4beb0', '#9a9484'], 2);
    g.strokeStyle = '#8d8778';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32, 128);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 32);
      g.lineTo(128, i * 32);
      g.stroke();
    }
    g.fillStyle = 'rgba(90,85,70,0.18)';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 8 + Math.random() * 14, 6 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// Brick courses with mortar and per-brick shade variation.
export function makeBrickTexture(base, mortar) {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = mortar;
    g.fillRect(0, 0, 128, 128);
    const bh = 16;
    const bw = 32;
    for (let row = 0; row < 128 / bh; row++) {
      const off = row % 2 === 0 ? 0 : bw / 2;
      for (let col = -1; col < 128 / bw + 1; col++) {
        const shade = 0.85 + Math.random() * 0.3;
        g.fillStyle = shadeColor(base, shade);
        g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  });
}

function shadeColor(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// Warm plaster with noise blotches and faint stains.
export function makePlasterTexture(base) {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 20, 5 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, 128, 128, 200, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)'], 2);
  });
}

// Terracotta roof tiles in overlapping rows.
export function makeRoofTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#8a4a34';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 9; col++) {
        const x = col * 16 + (row % 2 === 0 ? 0 : 8);
        const y = row * 16;
        g.fillStyle = shadeColor(0xa85a3e, 0.85 + Math.random() * 0.3);
        g.beginPath();
        g.arc(x + 8, y + 8, 8, 0, Math.PI);
        g.fill();
        g.strokeStyle = 'rgba(60,25,15,0.5)';
        g.lineWidth = 1;
        g.stroke();
      }
    }
  });
}

// Glass curtain wall: dark reflective panes, floor slabs and a few lit rooms.
export function makeGlassTexture() {
  return canvasTexture(128, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, '#2a4258');
    grad.addColorStop(0.5, '#4a6a86');
    grad.addColorStop(1, '#2a4258');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 24) {
      g.fillStyle = '#d8c9a8';
      g.fillRect(0, y, 128, 3);
      for (let x = 6; x < 122; x += 22) {
        const lit = Math.random() < 0.35;
        g.fillStyle = lit ? '#ffe9a8' : '#16222e';
        g.fillRect(x, y + 5, 15, 15);
        // Sky glint on some panes.
        if (!lit && Math.random() < 0.3) {
          g.fillStyle = 'rgba(190,220,240,0.35)';
          g.beginPath();
          g.moveTo(x, y + 20);
          g.lineTo(x + 15, y + 5);
          g.lineTo(x + 15, y + 12);
          g.lineTo(x + 7, y + 20);
          g.closePath();
          g.fill();
        }
      }
    }
  });
}

// Window facade for low-rise buildings: plaster + rows of windows, some lit.
export function makeWindowTexture(base, lit) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    speckle(g, 128, 256, 160, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], 2);
    for (let y = 12; y < 244; y += 28) {
      for (let x = 10; x < 118; x += 26) {
        const on = Math.random() < 0.42;
        g.fillStyle = on ? lit : '#1d2733';
        g.fillRect(x, y, 16, 18);
        // Sill + lintel.
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x - 1, y + 18, 18, 2);
        g.fillRect(x - 1, y - 2, 18, 2);
      }
    }
  });
}

// Grass with blades, speckles and a few bare patches.
export function makeGrassTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#5da24a';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 420, ['#4a8a3a', '#6cb45a', '#3f7a32', '#7cc46a'], 2);
    g.strokeStyle = 'rgba(40,100,35,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 3);
      g.stroke();
    }
    g.fillStyle = 'rgba(150,130,80,0.15)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 10 + Math.random() * 14, 7 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// Beach sand with grains and a few shells.
export function makeSandTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#e8d3a0';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 320, ['#dcc389', '#f2e2b8', '#c9ae72'], 2);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.arc(Math.random() * 128, Math.random() * 128, 1.5, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// Sea water: deep blue with pale wave streaks and foam flecks. Animated by
// sliding the texture offset in the game loop.
export function makeWaterTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2277a8';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      const y = Math.random() * 256;
      const len = 20 + Math.random() * 70;
      const x = Math.random() * 256;
      g.strokeStyle = `rgba(190,225,245,${0.12 + Math.random() * 0.25})`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y + (Math.random() - 0.5) * 8, x + len, y + (Math.random() - 0.5) * 6);
      g.stroke();
    }
    speckle(g, 256, 256, 120, ['rgba(255,255,255,0.25)', 'rgba(10,60,90,0.3)'], 2);
  });
}

// Wooden boardwalk planks.
export function makeBoardwalkTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#8a6f4d';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 8; i++) {
      const y = i * 16;
      g.fillStyle = shadeColor(0x9a7d58, 0.85 + Math.random() * 0.3);
      g.fillRect(0, y + 1, 128, 14);
      g.fillStyle = '#5a4630';
      g.fillRect(0, y, 128, 2);
      // Nail dots.
      g.fillStyle = '#3a2c1e';
      g.fillRect(8, y + 7, 2, 2);
      g.fillRect(118, y + 7, 2, 2);
    }
  });
}

// Corrugated shipping-container wall.
export function makeContainerTexture(base) {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x, 0, 4, 128);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 8, 0, 3, 128);
    }
    g.fillStyle = 'rgba(90,50,20,0.25)';
    for (let i = 0; i < 10; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 60, 3, 30 + Math.random() * 50);
    }
  });
}

// A painted shop sign with big readable text. `lines` is an array of
// { text, size, color } drawn centered, top to bottom.
export function makeSignTexture(lines, bg, border) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = border;
  g.lineWidth = 8;
  g.strokeRect(4, 4, 504, 120);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    g.font = `900 ${ln.size}px Arial, sans-serif`;
    g.fillStyle = ln.color;
    g.fillText(ln.text, 256, (128 / (n + 1)) * (i + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Striped awning canvas (red/white, teal/white, ...).
export function makeAwningTexture(c1, c2) {
  return canvasTexture(128, 64, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? c1 : c2;
      g.fillRect(i * 16, 0, 16, 64);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 56, 128, 8);
  });
}

// Zebra crossing: white bars on asphalt, drawn as one crossing strip.
export function makeCrosswalkTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 120, ['#2b2e33', '#3a3d42'], 2);
    g.fillStyle = '#f2f2f2';
    for (let x = 8; x < 128; x += 24) {
      g.fillRect(x, 6, 12, 116);
    }
  });
}

// Rounded-rectangle THREE.Shape, for extruded bodies with soft corners.
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
