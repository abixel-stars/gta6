// The Solmar HUD: stars, money, health, speed, mission objective, minimap,
// toasts, and the start / pause / settings / mission menus.
import { CITY_HALF, LANDMARKS, ROAD_LINES } from './city.js';
import { MISSIONS } from './missions.js';
import { money } from './util.js';

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {};
    for (const id of [
      'hud', 'stars', 'money', 'healthFill', 'speed', 'objective', 'toast',
      'minimap', 'crosshair', 'vignette', 'menu', 'menuTitle', 'menuBody',
      'menuPlay', 'menuHow', 'pauseMenu', 'pauseResume', 'pauseMissions',
      'pauseSettings', 'pauseQuit', 'settingsPanel', 'volSlider', 'qualitySelect',
      'settingsClose', 'missionPanel', 'missionList', 'missionClose', 'wasted',
      'interactPrompt', 'dialog', 'dialogName', 'dialogLine',
      'shopPanel', 'shopTitle', 'shopItems', 'shopMoney', 'shopClose',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
    this.dialogTimer = 0;
    this.objectiveText = '';
    this.wireButtons();
  }

  wireButtons() {
    this.el.menuPlay?.addEventListener('click', () => this.cb.onPlay());
    this.el.menuHow?.addEventListener('click', () => this.showHowToPlay());
    this.el.pauseResume?.addEventListener('click', () => this.cb.onResume());
    this.el.pauseMissions?.addEventListener('click', () => this.showMissionList());
    this.el.pauseSettings?.addEventListener('click', () => this.showSettings());
    this.el.pauseQuit?.addEventListener('click', () => this.cb.onQuitToMenu());
    this.el.settingsClose?.addEventListener('click', () => this.hidePanels());
    this.el.missionClose?.addEventListener('click', () => this.hidePanels());
    this.el.shopClose?.addEventListener('click', () => this.cb.onCloseShop?.());
    this.el.shopItems?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (btn) this.cb.onBuyShopItem?.(parseInt(btn.dataset.buy, 10));
    });
    this.el.volSlider?.addEventListener('input', (e) => this.cb.onVolume(e.target.value / 100));
    this.el.qualitySelect?.addEventListener('change', (e) => this.cb.onQuality(e.target.value));
  }

  // The [E] prompt above the objective: what the nearest usable thing does.
  setInteract(text) {
    if (!this.el.interactPrompt) return;
    if (text) {
      this.el.interactPrompt.innerHTML = `<span class="key">E</span> ${text}`;
      this.el.interactPrompt.style.display = 'block';
    } else {
      this.el.interactPrompt.style.display = 'none';
    }
  }

  // A pedestrian's reply, shown as a speech bubble for a few seconds.
  showDialog(name, line) {
    if (!this.el.dialog) return;
    this.el.dialogName.textContent = name;
    this.el.dialogLine.textContent = line;
    this.el.dialog.style.display = 'block';
    this.dialogTimer = 4.5;
  }

  hideDialog() {
    if (this.el.dialog) this.el.dialog.style.display = 'none';
    this.dialogTimer = 0;
  }

  // Boardwalk shop: item list with prices; click or press 1/2/3 to buy.
  showShop(shop, moneyNow) {
    if (!this.el.shopPanel) return;
    this.el.shopTitle.textContent = shop.name;
    this.el.shopMoney.textContent = `Your cash: ${money(moneyNow)} — press 1/2/3 or click to buy, E or Esc to leave`;
    this.el.shopItems.innerHTML = shop.items.map((it, i) => {
      const effect = it.heal ? `+${it.heal} HP` : it.ammo ? `+${it.ammo} ammo` : '';
      const afford = moneyNow >= it.price ? '' : ' disabled';
      return `<button class="shop-item${afford}" data-buy="${i}"><b>${i + 1}. ${it.name}</b><span>${effect}</span><i>${money(it.price)}</i></button>`;
    }).join('');
    this.el.shopPanel.style.display = 'block';
  }

  hideShop() {
    if (this.el.shopPanel) this.el.shopPanel.style.display = 'none';
  }

  shopVisible() {
    return !!this.el.shopPanel && this.el.shopPanel.style.display === 'block';
  }

  showMenu() {
    this.el.menu.style.display = 'flex';
    this.el.hud.style.display = 'none';
    this.el.pauseMenu.style.display = 'none';
    this.hidePanels();
  }

  hideMenu() {
    this.el.menu.style.display = 'none';
    this.el.hud.style.display = 'block';
  }

  showPause() {
    this.el.pauseMenu.style.display = 'flex';
  }

  hidePause() {
    this.el.pauseMenu.style.display = 'none';
    this.hidePanels();
  }

  hidePanels() {
    if (this.el.settingsPanel) this.el.settingsPanel.style.display = 'none';
    if (this.el.missionPanel) this.el.missionPanel.style.display = 'none';
  }

  showSettings() {
    this.hidePanels();
    this.el.settingsPanel.style.display = 'block';
  }

  showMissionList() {
    this.hidePanels();
    const done = this.cb.completedMissions ? this.cb.completedMissions() : new Set();
    this.el.missionList.innerHTML = MISSIONS.map((m, i) => {
      const state = done.has(m.id) ? 'DONE' : i === this.cb.activeMissionIndex?.() ? 'ACTIVE' : 'LOCKED';
      return `<div class="mission-row"><b>${i + 1}. ${m.title}</b> — ${state}<br><span>${m.briefing}</span><br><i>Reward: ${money(m.reward)}</i></div>`;
    }).join('');
    this.el.missionPanel.style.display = 'block';
  }

  showHowToPlay() {
    this.el.menuBody.innerHTML = `
      <h2>How to play</h2>
      <p><b>WASD</b> move / drive &nbsp; <b>Shift</b> sprint &nbsp; <b>E</b> use: talk, pick up, shop, enter car<br>
      <b>F</b> punch &nbsp; <b>Mouse</b> aim, <b>Click</b> shoot &nbsp; <b>R</b> reload<br>
      <b>Space</b> handbrake &nbsp; <b>L</b> missions &nbsp; <b>P</b> pause &nbsp; <b>M</b> mute &nbsp; <b>Wheel</b> zoom camera</p>
      <p>Steal cars, take jobs from the depot, and watch the stars: the police
      chase you when the heat is on. Lose them to cool off. Walk up to people
      and shops on the beach boardwalk — press E to talk, buy and pick things up.</p>
      <button id="howBack">Back</button>`;
    document.getElementById('howBack')?.addEventListener('click', () => this.showTitle());
  }

  showTitle() {
    this.el.menuBody.innerHTML = `
      <h1>SOLMAR</h1>
      <p class="tagline">Streets of the Sun — an open-world crime story</p>
      <p>Leo Marin owes the Marea crew. Five jobs stand between him and freedom.
      Steal cars, outrun the Solmar police, and finish the big score.</p>`;
  }

  showToast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = 4;
  }

  // Hide the toast at once (used by the screenshot stager so the briefing
  // does not cover the middle of a staged shot).
  hideToast() {
    this.el.toast.style.opacity = '0';
    this.toastTimer = 0;
  }

  setObjective(text) {
    if (text !== this.objectiveText) {
      this.objectiveText = text;
      this.el.objective.textContent = text;
    }
  }

  showWasted(text) {
    this.el.wasted.textContent = text;
    this.el.wasted.style.display = 'flex';
    setTimeout(() => {
      this.el.wasted.style.display = 'none';
    }, 2600);
  }

  flashDamage() {
    this.el.vignette.style.opacity = '0.85';
    setTimeout(() => {
      this.el.vignette.style.opacity = '0';
    }, 180);
  }

  update(dt, state) {
    // Stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = state.wanted > 0 ? '#ffcf3e' : '#888888';
    this.el.money.textContent = money(state.money);
    this.el.healthFill.style.width = `${Math.max(0, state.health * 100)}%`;
    this.el.healthFill.style.background = state.health > 0.5 ? '#58c96b' : state.health > 0.25 ? '#e8a13a' : '#d83a3a';
    this.el.speed.textContent = state.inCar ? `${Math.round(state.speedKmh)} km/h` : '';
    this.el.crosshair.style.display = state.aiming ? 'block' : 'none';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    if (this.dialogTimer > 0) {
      this.dialogTimer -= dt;
      if (this.dialogTimer <= 0) this.hideDialog();
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 200;
    const scale = S / (CITY_HALF * 2 + 60);
    const toMap = (x, z) => [(x + CITY_HALF + 30) * scale, (z + CITY_HALF + 30) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262b';
    ctx.fillRect(0, 0, S, S);
    // Beach + ocean.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, toMap(0, 220)[1], S, S - toMap(0, 220)[1]);
    ctx.fillStyle = '#e8d3a0';
    ctx.fillRect(0, toMap(0, 196)[1], S, toMap(0, 220)[1] - toMap(0, 196)[1]);
    // Park.
    ctx.fillStyle = '#3f8f3a';
    const [px, py] = toMap(-16, -16);
    ctx.fillRect(px, py, 32 * scale, 32 * scale);
    // Roads.
    ctx.strokeStyle = '#5a5f66';
    ctx.lineWidth = 5;
    for (const v of ROAD_LINES) {
      const [ax] = toMap(v, 0);
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, S);
      ctx.stroke();
      const [, az] = toMap(0, v);
      ctx.beginPath();
      ctx.moveTo(0, az);
      ctx.lineTo(S, az);
      ctx.stroke();
    }
    // Mission target.
    if (state.target) {
      const [tx, ty] = toMap(state.target.x, state.target.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 10 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police.
    ctx.fillStyle = '#4a7dff';
    for (const c of state.police) {
      const [cx, cy] = toMap(c.x, c.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic.
    ctx.fillStyle = '#bbbbbb';
    for (const c of state.traffic) {
      const [cx, cy] = toMap(c.x, c.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Player arrow.
    const [ux, uy] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 8, 14);
  }
}
