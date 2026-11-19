// The INTERACT system for Solmar v2: one clear prompt when the player is
// near something they can use — talk to a pedestrian, pick up cash or a
// medkit, step into a boardwalk shop, or get into a car. E does what the
// prompt says; everything else is scenery.
import * as THREE from 'three';
import { SHOPS } from './city.js';
import { money, rand } from './util.js';

const TALK_RANGE = 2.6;
const PICKUP_RANGE = 2.2;
const SHOP_RANGE = 3.5;
const CAR_RANGE = 4.5;

export class Interact {
  constructor(world) {
    this.world = world;
    this.current = null; // { kind, label, ... } or null
    this.shopOpen = false;
    this.openShopDef = null;
    this.pickups = [];
    this.spawnPickups();
  }

  spawnPickups() {
    const w = this.world;
    const cashGeo = new THREE.BoxGeometry(0.9, 0.08, 0.45);
    const cashMat = new THREE.MeshLambertMaterial({ color: 0x4ac96b });
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    for (let i = 0; i < 8; i++) {
      const p = this.findOpenSpot();
      const group = new THREE.Group();
      const stack = new THREE.Mesh(cashGeo, cashMat);
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.position.y = 0.12;
      group.add(stack, coin);
      group.position.set(p.x, 0.6, p.z);
      w.scene.add(group);
      this.pickups.push({
        mesh: group,
        x: p.x,
        z: p.z,
        kind: 'cash',
        amount: 20 + Math.floor(w.rng() * 4) * 10,
        taken: false,
        phase: w.rng() * 6,
      });
    }
    // Medkits: white box with a red cross.
    const kitGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7);
    const kitMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xd81f1f });
    for (let i = 0; i < 5; i++) {
      const p = this.findOpenSpot();
      const group = new THREE.Group();
      const box = new THREE.Mesh(kitGeo, kitMat);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), crossMat);
      c1.position.set(0, 0, 0.36);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), crossMat);
      c2.position.set(0, 0, 0.36);
      group.add(box, c1, c2);
      group.position.set(p.x, 0.6, p.z);
      w.scene.add(group);
      this.pickups.push({
        mesh: group,
        x: p.x,
        z: p.z,
        kind: 'medkit',
        amount: 30,
        taken: false,
        phase: w.rng() * 6,
      });
    }
  }

  findOpenSpot() {
    const w = this.world;
    for (let tries = 0; tries < 20; tries++) {
      const x = rand(w.rng, -190, 190);
      const z = rand(w.rng, -190, 190);
      if (!w.city.pointBlocked(x, z, 2)) return { x, z };
    }
    return { x: 0, z: 30 };
  }

  // Scan for the nearest usable thing and show its prompt.
  update(dt) {
    const w = this.world;
    const p = w.player;
    if (p.inCar || w.state !== 'playing') {
      this.setCurrent(null);
      return;
    }
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y = 0.6 + Math.sin(w.time * 3 + pk.phase) * 0.15;
    }
    let best = null;
    let bestD = Infinity;
    const consider = (d, cand) => {
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    };
    for (const shop of SHOPS) {
      const d = Math.hypot(p.pos.x - shop.x, p.pos.z - shop.z);
      if (d < SHOP_RANGE) consider(d, { kind: 'shop', label: `Enter ${shop.name}`, shop });
    }
    const ped = w.crowd.nearest(p.pos.x, p.pos.z, TALK_RANGE);
    if (ped && ped.talkCooldown <= 0) {
      const d = Math.hypot(p.pos.x - ped.pos.x, p.pos.z - ped.pos.z);
      consider(d, { kind: 'talk', label: `Talk to ${ped.name}`, ped });
    }
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const d = Math.hypot(p.pos.x - pk.x, p.pos.z - pk.z);
      if (d < PICKUP_RANGE) {
        consider(d, {
          kind: 'pickup',
          label: pk.kind === 'cash' ? `Pick up ${money(pk.amount)}` : 'Take medkit (+30 HP)',
          pickup: pk,
        });
      }
    }
    const car = w.traffic.nearestCar(p.pos.x, p.pos.z, CAR_RANGE, (c) => c.driver !== 'player');
    if (car) {
      const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      consider(d, { kind: 'car', label: `Get in the ${car.spec.name}`, car });
    }
    this.setCurrent(best);
  }

  setCurrent(cand) {
    this.current = cand;
    this.world.hud.setInteract(cand ? cand.label : null);
  }

  // Do what the prompt says. Returns true when something happened.
  use() {
    const w = this.world;
    const c = this.current;
    if (!c) return false;
    if (c.kind === 'talk') {
      const said = c.ped.talk();
      if (!said) return false;
      w.hud.showDialog(said.name, said.line);
      w.sound.blip(660, 0.08, 'sine', 0.15);
      if (said.tip > 0) {
        w.player.money += said.tip;
        w.hud.showToast(`${said.name} tipped you ${money(said.tip)}`);
        w.effects.pickupSparkle(c.ped.pos.x, 1.2, c.ped.pos.z);
      }
      return true;
    }
    if (c.kind === 'pickup') {
      const pk = c.pickup;
      pk.taken = true;
      pk.mesh.visible = false;
      if (pk.kind === 'cash') {
        w.player.money += pk.amount;
        w.hud.showToast(`Picked up ${money(pk.amount)}`);
      } else {
        w.player.health.heal(pk.amount);
        w.hud.showToast(`Medkit used — +${pk.amount} HP`);
      }
      w.effects.pickupSparkle(pk.x, 1, pk.z);
      w.sound.pickup();
      return true;
    }
    if (c.kind === 'shop') {
      this.openShop(c.shop);
      return true;
    }
    if (c.kind === 'car') {
      return w.tryEnterCar();
    }
    return false;
  }

  openShop(shop) {
    this.shopOpen = true;
    this.openShopDef = shop;
    this.world.hud.showShop(shop, this.world.player.money);
    this.world.sound.blip(520, 0.1, 'sine', 0.15);
  }

  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.openShopDef = null;
    this.world.hud.hideShop();
  }

  buy(index) {
    const w = this.world;
    const shop = this.openShopDef;
    if (!shop) return;
    const item = shop.items[index];
    if (!item) return;
    if (w.player.money < item.price) {
      w.hud.showToast('Not enough cash for that.');
      return;
    }
    w.player.money -= item.price;
    if (item.heal) w.player.health.heal(item.heal);
    if (item.ammo) w.player.combat.addAmmo(item.ammo);
    w.hud.showToast(`Bought ${item.name} for ${money(item.price)}`);
    w.sound.pickup();
    w.hud.showShop(shop, w.player.money);
  }
}
