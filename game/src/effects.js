// Lightweight particles for Solmar: sparks, smoke puffs, muzzle flashes and
// pickup sparkles. One THREE.Points cloud, recycled every frame.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    // Muzzle flash light, reused for gunshots.
    this.flash = new THREE.PointLight(0xffc861, 0, 18);
    this.scene.add(this.flash);
    this.flashTimer = 0;
  }

  spawn(x, y, z, opts) {
    const count = opts.count || 10;
    const color = opts.color || 0xffd23e;
    const speed = opts.speed || 5;
    const up = opts.up || 2;
    const life = opts.life || 0.7;
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      this.positions[idx * 3] = x + (Math.random() - 0.5) * 0.4;
      this.positions[idx * 3 + 1] = y + (Math.random() - 0.5) * 0.4;
      this.positions[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
      this.vel[idx * 3] = (Math.random() - 0.5) * speed;
      this.vel[idx * 3 + 1] = Math.random() * up;
      this.vel[idx * 3 + 2] = (Math.random() - 0.5) * speed;
      this.colors[idx * 3] = r;
      this.colors[idx * 3 + 1] = g;
      this.colors[idx * 3 + 2] = b;
      this.life[idx] = life * (0.6 + Math.random() * 0.6);
      this.maxLife[idx] = this.life[idx];
    }
  }

  sparks(x, y, z) {
    this.spawn(x, y, z, { count: 14, color: 0xffd23e, speed: 7, up: 4, life: 0.5 });
  }

  smoke(x, y, z) {
    this.spawn(x, y, z, { count: 8, color: 0x777777, speed: 1.5, up: 3, life: 1.4 });
  }

  blood(x, y, z) {
    this.spawn(x, y, z, { count: 10, color: 0xc22a2a, speed: 3, up: 2, life: 0.6 });
  }

  pickupSparkle(x, y, z) {
    this.spawn(x, y, z, { count: 18, color: 0x7dff9a, speed: 2, up: 4, life: 0.9 });
  }

  muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flash.intensity = 60;
    this.flashTimer = 0.06;
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.life[i] -= dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] = 0;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
  }
}
