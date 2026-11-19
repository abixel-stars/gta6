// Combat in Solmar: fists up close, a pistol at range, health and damage
// feedback. Crimes committed here feed the wanted level.
import * as THREE from 'three';
import { clamp } from './util.js';

export class Combat {
  constructor() {
    this.ammo = 12;
    this.reserve = 48;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
    this.muzzleTimer = 0;
    this.aiming = false;
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
  }

  canPunch() {
    return this.punchCooldown <= 0;
  }

  punch() {
    this.punchCooldown = 0.45;
  }

  canShoot() {
    return this.shotCooldown <= 0 && this.ammo > 0;
  }

  shoot() {
    if (!this.canShoot()) return false;
    this.ammo--;
    this.shotCooldown = 0.28;
    this.muzzleTimer = 0.07;
    return true;
  }

  reload() {
    if (this.reserve <= 0 || this.ammo >= 12) return false;
    const need = 12 - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    return true;
  }

  addAmmo(n) {
    this.reserve = clamp(this.reserve + n, 0, 120);
  }
}

// A simple health pool with slow regeneration out of combat.
export class Health {
  constructor(max) {
    this.max = max;
    this.value = max;
    this.lastDamageAt = -10;
  }

  damage(amount, now) {
    this.value = clamp(this.value - amount, 0, this.max);
    this.lastDamageAt = now;
  }

  heal(amount) {
    this.value = clamp(this.value + amount, 0, this.max);
  }

  update(dt, now) {
    if (now - this.lastDamageAt > 6 && this.value > 0) {
      this.value = clamp(this.value + 4 * dt, 0, this.max);
    }
  }

  get alive() {
    return this.value > 0;
  }

  get fraction() {
    return this.value / this.max;
  }
}

// Floating damage numbers and hit sparks live in the effects module; this
// helper just answers "did a punch land" for a target at a position.
export function punchHits(attackerPos, attackerHeading, targetPos, range, arc) {
  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  const ang = Math.atan2(dx, dz);
  let diff = ang - attackerHeading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < arc;
}

// Ray-sphere test for a pistol shot from origin along dir.
export function shotHits(origin, dir, targetPos, radius, maxDist) {
  const to = new THREE.Vector3().subVectors(targetPos, origin);
  const along = to.dot(dir);
  if (along < 0 || along > maxDist) return false;
  const closest = new THREE.Vector3().copy(origin).addScaledVector(dir, along);
  return closest.distanceTo(targetPos) < radius;
}
