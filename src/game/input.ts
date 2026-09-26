export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  attack: boolean;
  attackPressed: boolean;
  interact: boolean;
  interactPressed: boolean;
  pause: boolean;
  pausePressed: boolean;
}

export class InputSystem {
  private keys: Record<string, boolean> = {};
  private prevKeys: Record<string, boolean> = {};
  private touchInput = {
    left: false,
    right: false,
    jump: false,
    attack: false,
  pause: false,
  jumpPrev: false,
    attackPrev: false,
    pausePrev: false,
  up: false,
    down: false,
  interact: false,
  interactPrev: false,
  fullScreen: false,
  fullScreenPrev: false,
  debug: false,
    debugPrev: false,
  pausePrev2: false,
  attackPrev2: false,
    jumpPrev2: false,
  interactPrev2: false,
  fullScreenPrev2: false,
    debugPrev2: false,
  pausePrev3: false,
    attackPrev3: false,
    jumpPrev3: false,
    interactPrev3: false,
    fullScreenPrev3: false,
    debugPrev3: false,
  };

  private onFullscreen?: () => void;
  private onDebug?: () => void;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  setCallbacks(onFullscreen?: () => void, onDebug?: () => void): void {
    this.onFullscreen = onFullscreen;
    this.onDebug = onDebug;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(key)) {
      e.preventDefault();
    }
    if (key === 'f11' && this.onFullscreen) {
      e.preventDefault();
      this.onFullscreen();
      return;
    }
    if (key === 'f3' && this.onDebug) {
      e.preventDefault();
      this.onDebug();
      return;
    }
    this.keys[key] = true;
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private handleBlur = (): void => {
    this.keys = {};
  };

  setTouch(state: Partial<typeof this.touchInput>): void {
    Object.assign(this.touchInput, state);
  }

  getState(): InputState {
    const k = this.keys;
    const t = this.touchInput;

    const left = !!(k['a'] || k['arrowleft'] || t.left);
    const right = !!(k['d'] || k['arrowright'] || t.right);
    const up = !!(k['w'] || k['arrowup'] || t.up);
    const down = !!(k['s'] || k['arrowdown'] || t.down);
    const jump = !!(k[' '] || k['w'] || k['arrowup'] || t.jump);
    const attack = !!(k['e'] || k['j'] || k['x'] || t.attack);
    const interact = !!(k['e'] || t.interact);
    const pause = !!(k['escape'] || k['p'] || t.pause);

    const jumpPressed = jump && !(this.prevKeys[' '] || this.prevKeys['w'] || this.prevKeys['arrowup'] || t.jumpPrev);
    const attackPressed = attack && !(this.prevKeys['e'] || this.prevKeys['j'] || this.prevKeys['x'] || t.attackPrev);
    const interactPressed = interact && !(this.prevKeys['e'] || t.interactPrev);
    const pausePressed = pause && !(this.prevKeys['escape'] || this.prevKeys['p'] || t.pausePrev);

    this.prevKeys = { ...this.keys };
    this.touchInput.jumpPrev = t.jump;
    this.touchInput.attackPrev = t.attack;
    this.touchInput.interactPrev = t.interact;
    this.touchInput.pausePrev = t.pause;

    return { left, right, up, down, jump, jumpPressed, attack, attackPressed, interact, interactPressed, pause, pausePressed };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
