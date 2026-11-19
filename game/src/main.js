// Solmar: an open-world crime story. Boots the city, the player, traffic,
// police, missions and HUD, and runs the game loop.
import * as THREE from 'three';
import { City, LANDMARKS } from './city.js';
import { Traffic, buildCarMesh, Car } from './vehicles.js';
import { Crowd } from './pedestrians.js';
import { Police, Wanted } from './police.js';
import { Combat, Health, punchHits, shotHits } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { loadSave, writeSave } from './save.js';
import { clamp, damp, money, mulberry32, rand } from './util.js';

const PLAYER_SPEED = 5.2;
const PLAYER_SPRINT = 8.4;

class Player {
  constructor(scene, rng) {
    this.rng = rng;
    this.pos = new THREE.Vector3(-170, 0, -38);
    this.heading = Math.PI / 2;
    this.vel = new THREE.Vector3();
    this.health = new Health(100);
    this.money = 100;
    this.inCar = false;
    this.car = null;
    this.combat = new Combat();
    this.mesh = this.buildMesh();
    scene.add(this.mesh);
    this.walkPhase = 0;
  }

  buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a7a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a3440 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 8), jacket);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8), skin);
    head.position.y = 1.74;
    head.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8c832 })
    );
    cap.position.y = 1.95;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 6), pants);
    legL.position.set(-0.15, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6), jacket);
    armL.position.set(-0.45, 1.1, 0);
    const armR = armL.clone();
    armR.position.x = 0.45;
    g.add(body, head, cap, legL, legR, armL, armR);
    g.userData.legs = [legL, legR];
    g.userData.arms = [armL, armR];
    return g;
  }

  update(dt, input, city, cameraYaw) {
    if (this.inCar) return;
    const axis = input.moveAxis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER_SPRINT : PLAYER_SPEED;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const mx = (axis.s * cos + axis.f * sin) * speed;
    const mz = (axis.s * -sin + axis.f * cos) * speed;
    this.vel.x = damp(this.vel.x, mx, 12, dt);
    this.vel.z = damp(this.vel.z, mz, 12, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.x = clamp(this.pos.x, -218, 218);
    this.pos.z = clamp(this.pos.z, -218, 262);
    city.collideCircle(this.pos, 0.6);
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.5) {
      this.heading = Math.atan2(this.vel.x, this.vel.z);
      this.walkPhase += dt * moving * 1.6;
    }
    const swing = Math.sin(this.walkPhase) * (moving > 0.5 ? 0.55 : 0);
    const legs = this.mesh.userData.legs;
    const arms = this.mesh.userData.arms;
    if (legs) {
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
    }
    if (arms) {
      arms[0].rotation.x = -swing * 0.7;
      arms[1].rotation.x = swing * 0.7;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}

export class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.seed = parseInt(this.params.get('seed') || '1', 10) || 1;
    this.rng = mulberry32(this.seed);
    this.errors = [];
    window.addEventListener('error', (e) => this.errors.push(String(e.message || e.error)));
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0xf2d8a8, 220, 720);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.setupLights();
    this.city = new City(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.city, this.rng);
    this.traffic.populate(16);
    this.crowd = new Crowd(this.scene, this.rng);
    this.crowd.populate(22);
    this.police = new Police(this.scene, this.city, this.rng);
    this.wanted = new Wanted();
    this.player = new Player(this.scene, this.rng);
    this.effects = new Effects(this.scene);
    this.sound = new SoundBank();
    this.input = new Input(this.canvas);
    this.hud = new Hud({
      onPlay: () => this.play(),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onVolume: (v) => this.sound.setVolume(v),
      onQuality: (q) => this.setQuality(q),
      completedMissions: () => this.missions.completed,
      activeMissionIndex: () => this.missions.activeIndex,
    });
    this.missions = new MissionManager(this);
    this.state = 'menu'; // menu | playing | paused | wasted
    this.time = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.cameraDist = 8;
    this.bustProgress = 0;
    this.saveTimer = 0;
    this.cashPickups = [];
    this.spawnCash();
    this.spawnMissionCars();
    this.loadProgress();
    this.bindResize();
    this.applyShotStaging();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.7);
    sun.position.set(140, 190, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);
    this.sun = sun;
  }

  spawnCash() {
    const geo = new THREE.BoxGeometry(0.9, 0.08, 0.45);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4ac96b });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, mat);
      const x = rand(this.rng, -190, 190);
      const z = rand(this.rng, -190, 190);
      m.position.set(x, 0.6, z);
      this.scene.add(m);
      this.cashPickups.push({ mesh: m, x, z, amount: 20 + Math.floor(this.rng() * 4) * 10, taken: false });
    }
  }

  spawnMissionCars() {
    // The courier van at the depot and the Cometa GT at the hotel.
    const van = this.traffic.spawnParked('van', LANDMARKS.depot.x + 6, LANDMARKS.depot.z, Math.PI / 2);
    van.missionCar = 'van';
    const gt = this.traffic.spawnParked('sports', LANDMARKS.hotel.x + 8, LANDMARKS.hotel.z + 4, 0);
    gt.missionCar = 'sports';
  }

  loadProgress() {
    const save = loadSave();
    if (!save) return;
    this.player.money = save.money || 100;
    if (Array.isArray(save.completed)) {
      for (const id of save.completed) this.missions.completed.add(id);
    }
    if (save.pos) {
      this.player.pos.set(save.pos.x, 0, save.pos.z);
    }
    this.hasSave = true;
  }

  saveGame() {
    writeSave({
      money: Math.round(this.player.money),
      completed: [...this.missions.completed],
      pos: { x: this.player.pos.x, z: this.player.pos.z },
    });
  }

  bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setQuality(q) {
    if (q === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(1.25);
      this.renderer.shadowMap.enabled = true;
      this.sun.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.sun.shadow.mapSize.set(2048, 2048);
    }
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  play() {
    this.sound.ensure();
    this.sound.startMusic();
    this.hud.hideMenu();
    this.state = 'playing';
    if (!this.missions.current && this.missions.completed.size < MISSIONS.length) {
      this.missions.startNext();
    }
  }

  resume() {
    this.hud.hidePause();
    this.state = 'playing';
  }

  quitToMenu() {
    this.saveGame();
    this.state = 'menu';
    this.hud.showMenu();
    this.hud.showTitle();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  // --- Shot staging: deterministic scenes for screenshots. ---
  applyShotStaging() {
    const shot = this.params.get('shot');
    if (!shot) {
      this.hud.showMenu();
      this.hud.showTitle();
      return;
    }
    this.sound.ensure();
    if (shot === 'start') {
      this.state = 'menu';
      this.hud.showMenu();
      this.hud.showTitle();
      this.player.pos.set(-22, 0, 60);
      return;
    }
    this.state = 'playing';
    this.hud.hideMenu();
    if (shot === 'street') {
      this.player.pos.set(-22, 0, 22);
      this.player.heading = Math.PI / 2;
      this.cameraYaw = Math.PI * 0.85;
      this.missions.start(0);
    } else if (shot === 'chase') {
      // Chase up the x=-22 road into downtown: the player speeds north in
      // the Cometa GT, a police roadblock waits ahead, live cruisers chase
      // from behind (visible on the minimap).
      const gt = this.traffic.cars.find((c) => c.missionCar === 'sports') || this.traffic.spawnParked('sports', -22, 100, Math.PI);
      gt.pos.set(-22, 0, 100);
      gt.heading = Math.PI;
      gt.speed = 26;
      gt.driver = 'player';
      this.player.car = gt;
      this.player.inCar = true;
      this.player.mesh.visible = false;
      this.player.pos.copy(gt.pos);
      this.wanted.stars = 3;
      this.wanted.heat = 40;
      this.traffic.spawnParked('cruiser', -22, 30, 0);
      this.traffic.spawnParked('cruiser', -16, 34, 0.3);
      this.police.spawnCruiserNear(-22, 100);
      this.police.spawnCruiserNear(-22, 100);
      this.police.cruisers[0].pos.set(-26, 128);
      this.police.cruisers[1].pos.set(-18, 134);
      this.missions.start(3);
      this.cameraYaw = Math.PI;
      this.cameraPitch = 0.45;
      this.cameraDist = 9;
    } else if (shot === 'harbor') {
      this.player.pos.set(196, 0, -168);
      this.player.heading = -Math.PI / 2;
      this.cameraYaw = Math.PI * 0.4;
      this.missions.start(2);
      // Dusk light for the harbor shot.
      this.scene.background = new THREE.Color(0xe8a06a);
      this.scene.fog = new THREE.Fog(0xe8a06a, 200, 650);
      this.sun.color.setHex(0xff9a50);
      this.sun.position.set(-160, 90, 40);
    }
    if (this.params.get('selftest') === '1') this.runSelfTest();
  }

  // Scripted playtest: walk, enter a car, start mission 1, report results.
  // Driven by game time, so it stays correct even when frames are slow.
  runSelfTest() {
    const results = { walked: false, enteredCar: false, missionStarted: false, errors: [] };
    window.__selftest = results;
    const startTime = this.time;
    const startPos = this.player.pos.clone();
    const pollStart = performance.now();
    this.input.inject('KeyW', true);
    const poll = setInterval(() => {
      const elapsed = this.time - startTime;
      const finish = (walked) => {
        results.walked = walked;
        this.input.inject('KeyW', false);
        const car = this.traffic.nearestCar(this.player.pos.x, this.player.pos.z, 60, (c) => !c.driver);
        if (car) {
          this.player.pos.set(car.pos.x + 3, 0, car.pos.z);
          this.tryEnterCar();
        }
        results.enteredCar = this.player.inCar;
        if (!this.missions.current) this.missions.start(0);
        results.missionStarted = !!this.missions.current;
        results.money = Math.round(this.player.money);
        results.playerPos = { x: +this.player.pos.x.toFixed(1), z: +this.player.pos.z.toFixed(1) };
        results.errors = this.errors.slice();
        clearInterval(poll);
        document.title = 'SELFTEST-DONE';
        console.log('SELFTEST ' + JSON.stringify(results));
      };
      if (elapsed >= 0.8) {
        finish(this.player.pos.distanceTo(startPos) > 1);
      } else if (performance.now() - pollStart > 25000) {
        // Game time never advanced: the loop is dead.
        finish(false);
      }
    }, 200);
  }

  tryEnterCar() {
    const near = this.traffic.nearestCar(this.player.pos.x, this.player.pos.z, 4.5, (c) => c.driver !== 'player');
    if (!near) return false;
    if (near.driver === 'traffic') {
      // Stealing a car in traffic: the driver flees, the heat goes up.
      near.driver = 'player';
      this.wanted.addCrime(60);
      this.crowd.scare(near.pos.x, near.pos.z, 12);
      this.hud.showToast('You stole a car! The police are on their way.');
    } else {
      near.driver = 'player';
    }
    this.player.car = near;
    this.player.inCar = true;
    this.player.mesh.visible = false;
    this.player.pos.copy(near.pos);
    this.sound.carDoor();
    return true;
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    this.player.inCar = false;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.player.pos.set(car.pos.x + 2.5, 0, car.pos.z + 1);
    this.player.heading = car.heading;
    this.sound.carDoor();
  }

  tryPunch() {
    if (!this.player.combat.canPunch()) return;
    this.player.combat.punch();
    this.sound.punch();
    const p = this.player;
    const targets = [];
    const ped = this.crowd.nearest(p.pos.x, p.pos.z, 2.4);
    if (ped) targets.push({ pos: ped.pos, kind: 'ped', ref: ped });
    for (const c of this.police.cruisers) {
      if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 2.4) {
        targets.push({ pos: c.pos, kind: 'cop', ref: c });
      }
    }
    for (const t of targets) {
      if (!punchHits(p.pos, p.heading, t.pos, 2.4, 1.1)) continue;
      this.effects.blood(t.pos.x, 1.2, t.pos.z);
      if (t.kind === 'ped') {
        t.ref.fleeFrom(p.pos.x, p.pos.z);
        this.wanted.addCrime(45);
        this.hud.showToast('Assault! Wanted level up.');
      } else {
        this.wanted.addCrime(80);
      }
      break;
    }
  }

  tryShoot() {
    if (!this.player.combat.shoot()) {
      if (this.player.combat.ammo === 0) this.hud.showToast('Out of ammo — press R to reload');
      return;
    }
    this.sound.gunshot();
    const p = this.player;
    const origin = new THREE.Vector3(p.pos.x, 1.5, p.pos.z);
    const dir = new THREE.Vector3(Math.sin(this.cameraYaw), -0.04, Math.cos(this.cameraYaw)).normalize();
    const muzzlePos = origin.clone().addScaledVector(dir, 1.2);
    this.effects.muzzle(muzzlePos.x, muzzlePos.y, muzzlePos.z);
    this.effects.sparks(muzzlePos.x, muzzlePos.y, muzzlePos.z);
    this.crowd.scare(p.pos.x, p.pos.z, 30);
    // Hit the nearest pedestrian or cruiser in the line of fire.
    let hit = false;
    for (const ped of this.crowd.peds) {
      const tp = new THREE.Vector3(ped.pos.x, 1.2, ped.pos.z);
      if (shotHits(origin, dir, tp, 0.9, 70)) {
        this.effects.blood(tp.x, tp.y, tp.z);
        ped.fleeFrom(p.pos.x, p.pos.z);
        this.wanted.addCrime(60);
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const c of this.police.cruisers) {
        const tp = new THREE.Vector3(c.pos.x, 1.0, c.pos.z);
        if (shotHits(origin, dir, tp, 1.6, 70)) {
          this.effects.sparks(tp.x, tp.y, tp.z);
          this.wanted.addCrime(80);
          hit = true;
          break;
        }
      }
    }
    if (hit) this.hud.flashDamage();
  }

  getBusted() {
    this.player.money = Math.max(0, this.player.money - 100);
    this.wanted.reset();
    this.police.clear();
    if (this.player.inCar) {
      this.player.car.driver = null;
      this.player.car = null;
      this.player.inCar = false;
      this.player.mesh.visible = true;
    }
    this.player.pos.set(LANDMARKS.safehouse.x, 0, LANDMARKS.safehouse.z);
    this.player.health.value = 100;
    this.hud.showWasted('BUSTED — fined $100');
    this.sound.busted();
    this.saveGame();
  }

  getWasted() {
    this.player.money = Math.max(0, this.player.money - 50);
    this.wanted.reset();
    this.police.clear();
    if (this.player.inCar) {
      this.player.car.driver = null;
      this.player.car = null;
      this.player.inCar = false;
      this.player.mesh.visible = true;
    }
    this.player.pos.set(LANDMARKS.safehouse.x, 0, LANDMARKS.safehouse.z);
    this.player.health.value = 100;
    this.hud.showWasted('WASTED');
    this.sound.busted();
    this.saveGame();
  }

  updateCamera(dt) {
    const mouse = this.input.consumeMouse();
    this.cameraYaw -= mouse.dx * 0.0032;
    this.cameraPitch = clamp(this.cameraPitch + mouse.dy * 0.0022, -0.15, 0.9);
    this.cameraDist = clamp(this.cameraDist + this.input.consumeWheel() * 0.005, 4, 12);
    const p = this.player;
    let target;
    if (p.inCar && p.car) {
      // Chase camera eases behind the car.
      const carYaw = p.car.heading;
      let diff = carYaw - this.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(p.car.speed) > 4) this.cameraYaw += diff * Math.min(1, 1.6 * dt);
      target = new THREE.Vector3(p.car.pos.x, 2.1, p.car.pos.z);
    } else {
      target = new THREE.Vector3(p.pos.x, 1.7, p.pos.z);
    }
    const dist = p.inCar ? this.cameraDist + 2 : this.cameraDist;
    const cx = target.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const cz = target.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const cy = target.y + Math.sin(this.cameraPitch) * dist + 1.2;
    const want = new THREE.Vector3(cx, Math.max(cy, 1.2), cz);
    this.camera.position.lerp(want, 1 - Math.exp(-10 * dt));
    this.camera.lookAt(target);
  }

  update(dt) {
    const p = this.player;
    const input = this.input;
    if (input.hit('KeyP') || input.hit('Escape')) this.togglePause();
    if (input.hit('KeyM')) this.sound.setMuted(!this.sound.muted);
    if (this.state !== 'playing') {
      // Menu backdrop: slow orbit around downtown.
      if (this.state === 'menu') {
        this.time += dt;
        const a = this.time * 0.05;
        this.camera.position.set(Math.sin(a) * 120, 55, Math.cos(a) * 120);
        this.camera.lookAt(0, 10, 0);
        this.traffic.update(dt, null);
        this.crowd.update(dt);
      }
      return;
    }
    this.time += dt;
    // Player + car.
    if (p.inCar && p.car) {
      const d = input.driveAxis();
      const handbrake = input.down('Space');
      p.car.drive(d.throttle, d.steer, dt, handbrake);
      p.pos.copy(p.car.pos);
      // Crash into a building at speed hurts.
      const before = p.car.speed;
      this.city.collideCircle(p.car.pos, 2.1);
      if (Math.abs(before) > 14 && Math.abs(p.car.speed) < Math.abs(before) * 0.4) {
        p.car.speed *= 0.3;
        this.effects.sparks(p.car.pos.x, 1, p.car.pos.z);
        this.sound.punch();
      }
      if (handbrake && Math.abs(p.car.speed) > 8 && Math.random() < 0.3) {
        this.effects.smoke(p.car.pos.x, 0.4, p.car.pos.z);
      }
      this.sound.setEngine(Math.abs(p.car.speed) / p.car.spec.speed, true);
    } else {
      p.update(dt, input, this.city, this.cameraYaw);
      this.sound.setEngine(0, false);
      if (input.hit('KeyF')) this.tryPunch();
      if (input.consumeClick()) this.tryShoot();
      if (input.hit('KeyR')) {
        if (p.combat.reload()) this.hud.showToast('Reloaded');
      }
    }
    if (input.hit('KeyE')) {
      if (p.inCar) this.exitCar();
      else this.tryEnterCar();
    }
    if (input.hit('KeyJ')) {
      if (!this.missions.current) this.missions.startNext();
    }
    // Cash pickups.
    for (const c of this.cashPickups) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 0.6 + Math.sin(this.time * 3 + c.x) * 0.15;
      if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 1.6) {
        c.taken = true;
        c.mesh.visible = false;
        p.money += c.amount;
        this.effects.pickupSparkle(c.x, 1, c.z);
        this.sound.pickup();
        this.hud.showToast(`Picked up ${money(c.amount)}`);
      }
    }
    // World.
    this.traffic.update(dt, p.pos);
    this.crowd.update(dt);
    this.police.syncCount(this.wanted.stars, p.pos);
    const nearestCop = this.police.nearestDist(p.pos.x, p.pos.z);
    this.wanted.update(dt, nearestCop);
    if (this.wanted.stars > 0) {
      this.police.update(dt, p.pos, p.inCar ? p.car.speed : 0, (bustDt) => {
        this.bustProgress += bustDt;
        if (this.bustProgress > 2) {
          this.bustProgress = 0;
          this.getBusted();
        }
      });
      this.sound.setSiren(true);
    } else {
      this.sound.setSiren(false);
      this.bustProgress = Math.max(0, this.bustProgress - dt);
    }
    // Police ram damage on foot.
    if (!p.inCar && nearestCop < 2.6) {
      p.health.damage(10 * dt, this.time);
      this.hud.flashDamage();
    }
    p.health.update(dt, this.time);
    if (!p.health.alive) this.getWasted();
    // Missions.
    this.missions.update(dt, this.time);
    // Effects + audio + HUD.
    this.effects.update(dt);
    this.sound.update(dt);
    this.updateCamera(dt);
    const target = this.missions.targetPos;
    this.hud.update(dt, {
      wanted: this.wanted.stars,
      money: p.money,
      health: p.health.fraction,
      inCar: p.inCar,
      speedKmh: p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : 0,
      aiming: !p.inCar,
      target: target ? { x: target.x, z: target.z } : null,
      police: this.police.cruisers.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      traffic: this.traffic.cars.filter((c) => c.driver === 'traffic').map((c) => ({ x: c.pos.x, z: c.pos.z })),
      player: { x: p.pos.x, z: p.pos.z, heading: p.inCar && p.car ? p.car.heading : p.heading },
    });
    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 15) {
      this.saveTimer = 0;
      this.saveGame();
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000 || 0.016));
    this.last = now;
    this.update(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

window.__game = new Game();
