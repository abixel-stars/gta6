// Keyboard and mouse state for Solmar. The game reads this each frame; the
// shot stager can also inject synthetic keys for scripted sequences.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.wheel = 0;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onWheel = (e) => {
      this.wheel += e.deltaY;
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onLockChange);
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  hit(code) {
    return this.pressed.has(code);
  }

  // Movement axes: -1..1 for forward and strafe.
  moveAxis() {
    let f = 0;
    let s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  }

  // Driving axes: throttle -1..1, steer -1..1.
  driveAxis() {
    let throttle = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) throttle += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) throttle -= 1;
    let steer = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) steer += 1;
    if (this.down('KeyD') || this.down('ArrowRight')) steer -= 1;
    return { throttle, steer };
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  endFrame() {
    this.pressed.clear();
  }

  // Test hook: pretend a key is held, for scripted self-tests.
  inject(code, held) {
    if (held) this.keys.add(code);
    else this.keys.delete(code);
  }
}
