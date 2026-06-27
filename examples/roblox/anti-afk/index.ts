// Anti-AFK — taps the jump key on a timer so the game does not kick you for
// being idle. Reads no memory; it only sends input. It targets Roblox because
// input is gated to the attached game window — key taps only fire while Roblox
// owns the foreground, and a macro with no target cannot send input at all.

import {
  Action,
  Button,
  Divider,
  Macro,
  MacroBase,
  number,
  OnStart,
  OnStop,
  OnTick,
  Panel,
  robloxTarget,
  Row,
  Stat,
  string,
  Text,
} from '@nighthawk.hq/macro-sdk';

type State = {
  jumps: number;
  nextInSeconds: number;
};

@Macro({ target: robloxTarget(), capabilities: { input: true } })
export default class AntiAfkMacro extends MacroBase<State> {
  static settings = {
    intervalSeconds: number({
      label: 'Jump every (seconds)',
      description: 'How long to wait between jumps.',
      min: 1,
      max: 6000,
      step: 1,
      default: 605,
    }),
    jitterSeconds: number({
      label: 'Random jitter (± seconds)',
      description: 'Vary each interval so jumps are not perfectly periodic. 0 disables.',
      min: 0,
      max: 60,
      step: 1,
      default: 5,
    }),
    jumpKey: string({
      label: 'Jump key',
      description: 'Key tapped to jump. In Roblox that is the spacebar.',
      default: 'space',
    }),
  };

  initialState: State = { jumps: 0, nextInSeconds: 0 };

  #nextJumpAt = 0;

  @OnStart()
  start() {
    this.setState({ jumps: 0 });
    this.#scheduleNext();
    this.log.info('Anti-AFK started.');
  }

  @OnTick(4)
  async tick() {
    const now = this.ctx.now();
    this.setState({ nextInSeconds: Math.max(0, Math.ceil((this.#nextJumpAt - now) / 1000)) });
    if (now < this.#nextJumpAt) return;
    if (await this.#jump()) this.#scheduleNext();
  }

  @OnStop()
  stop() {
    this.log.info('Anti-AFK stopped.');
  }

  @Action({ id: 'jumpNow', bindable: true, label: 'Jump now', suggestedKey: 'F8' })
  async jumpNow() {
    if (await this.#jump()) this.#scheduleNext();
  }

  async #jump(): Promise<boolean> {
    // Sending input requires the `input` capability AND holding the cooperative driver lock —
    // the host drops input otherwise. acquire() returns false when another macro is driving, so
    // we skip this jump and try again next tick rather than fight over the keyboard. We hold the
    // lock only for the tap, then release it so co-running macros get their turn.
    if (!this.workflow.acquire('anti-afk')) return false;
    const key = (this.settings.jumpKey as string) || 'space';
    await this.input.tapKey(key);
    this.workflow.release('anti-afk');
    this.setState({ jumps: this.state.jumps + 1 });
    return true;
  }

  #scheduleNext() {
    const intervalMs = (this.settings.intervalSeconds as number) * 1000;
    const jitterMs = (this.settings.jitterSeconds as number) * 1000;
    // A wall-clock-derived offset in [-jitterMs, jitterMs) — varies the interval
    // without depending on Math.random, which the sandbox may not provide.
    const offset = jitterMs > 0 ? (this.ctx.now() % (2 * jitterMs)) - jitterMs : 0;
    this.#nextJumpAt = this.ctx.now() + Math.max(250, intervalMs + offset);
  }

  @Panel({ id: 'overview', title: '' })
  overview() {
    return [
      Text('Taps the jump key on a timer to avoid the idle kick. Keep Roblox focused.'),
      Divider(),
      Row([
        Stat('Jumps', 'jumps', { tone: 'ok' }),
        Stat('Next in (s)', 'nextInSeconds', { tone: 'info' }),
      ]),
      Divider(),
      Row([Button('Jump now', 'jumpNow', { variant: 'outline' })]),
    ];
  }
}
