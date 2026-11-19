// Wanted level and the Solmar police: cruisers that chase, ram, and bust
// the player, and a heat system that cools off when the player hides.
import * as THREE from 'three';
import { clamp } from './util.js';
import { buildCarMesh, Car } from './vehicles.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.heat = 0; // 0..100 within the current star level
    this.hiddenTimer = 0;
    this.bustTimer = 0;
  }

  addCrime(amount) {
    if (this.stars >= 5) return;
    this.heat += amount;
    while (this.heat >= 100 && this.stars < 5) {
      this.heat -= 100;
      this.stars++;
    }
    this.hiddenTimer = 0;
  }

  // dt seconds; nearestCopDist in meters, or Infinity when no cop is near.
  update(dt, nearestCopDist) {
    if (this.stars === 0) return;
    if (nearestCopDist > 45) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 6) {
        this.heat -= 14 * dt;
        if (this.heat <= 0) {
          this.heat = 100;
          this.stars = Math.max(0, this.stars - 1);
          this.hiddenTimer = 0;
        }
      }
    } else {
      this.hiddenTimer = 0;
    }
  }

  reset() {
    this.stars = 0;
    this.heat = 0;
    this.hiddenTimer = 0;
    this.bustTimer = 0;
  }
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cruisers = [];
    this.spawnTimer = 0;
    this.flashTimer = 0;
  }

  wantedCruiserCount(stars) {
    return stars === 0 ? 0 : Math.min(1 + stars, 5);
  }

  spawnCruiserNear(x, z) {
    const mesh = buildCarMesh('cruiser', this.rng);
    const car = new Car(mesh, 'cruiser');
    const angle = this.rng() * Math.PI * 2;
    const dist = 55 + this.rng() * 25;
    car.pos.set(
      clamp(x + Math.cos(angle) * dist, -210, 210),
      0,
      clamp(z + Math.sin(angle) * dist, -210, 210)
    );
    car.heading = Math.atan2(x - car.pos.x, z - car.pos.z);
    car.driver = 'police';
    car.speed = 12;
    this.scene.add(mesh);
    this.cruisers.push(car);
    return car;
  }

  clear() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
  }

  nearestDist(x, z) {
    let best = Infinity;
    for (const c of this.cruisers) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  // Chase the target (player position). Returns true while a cruiser is
  // close enough to start a bust.
  update(dt, target, targetSpeed, onBustProgress) {
    this.flashTimer += dt;
    const lightsOn = Math.floor(this.flashTimer / 0.25) % 2 === 0;
    for (const c of this.cruisers) {
      const lights = c.mesh.userData.lights || [];
      if (lights[0]) lights[0].material.color.setHex(lightsOn ? 0xff2a2a : 0x881111);
      if (lights[1]) lights[1].material.color.setHex(lightsOn ? 0x111188 : 0x2a5aff);
    }
    for (const c of this.cruisers) {
      const dx = target.x - c.pos.x;
      const dz = target.z - c.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Police drive fast but turn wider than the player.
      const turn = clamp(diff, -1, 1) * 2.4 * dt;
      c.heading += turn;
      const desired = clamp(14 + dist * 0.35, 14, c.spec.speed);
      c.speed += (desired - c.speed) * dt * 0.8;
      const f = c.forward;
      c.pos.addScaledVector(f, c.speed * dt);
      // Avoid buildings: nudge along the road grid when blocked.
      if (this.city.pointBlocked(c.pos.x, c.pos.z, 2.2)) {
        c.pos.addScaledVector(f, -c.speed * dt * 2);
        c.heading += 0.9 * dt * 10;
      }
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = c.heading;
      const wheels = c.mesh.userData.wheels || [];
      for (const w of wheels) w.rotation.x += c.speed * dt * 2.4;
      // Ram: slow the target is handled by the player code; bust check here.
      if (dist < 3.2) {
        onBustProgress(dt);
      }
    }
  }

  // Keep the cruiser count matched to the wanted level.
  syncCount(stars, playerPos) {
    const want = this.wantedCruiserCount(stars);
    this.spawnTimer -= 1 / 60;
    while (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnCruiserNear(playerPos.x, playerPos.z);
      this.spawnTimer = 1.5;
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
  }
}
