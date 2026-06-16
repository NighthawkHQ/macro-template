// Coordinated rotation — plays a short key combo spread across several ticks,
// then idles for a cooldown and repeats. It exists to show the workflow driver:
// the combo is a *multi-tick activity*, and if a second macro shared the game it
// could tap a key between our steps and corrupt the rotation. `acquire` claims
// the shared input channel for the whole combo so that can't happen; `release`
// hands it back during the idle gap so the other macro gets a turn.
//
// Rule of thumb: reach for the workflow driver whenever one logical action spans
// more than one tick and another macro might run on the same game. A single
// self-contained tap (see anti-afk) does not need it.

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
  status: string;
  rotations: number;
  nextInSeconds: number;
};

@Macro({ target: robloxTarget(), capabilities: { input: true } })
export default class CoordinatedRotationMacro extends MacroBase<State> {
  static settings = {
    comboKeys: string({
      label: 'Combo keys',
      description: 'Keys tapped in order, one per tick. Comma-separated.',
      default: '1,2,3',
    }),
    cooldownSeconds: number({
      label: 'Cooldown (seconds)',
      description: 'Idle time between rotations. The input channel is released during this gap.',
      min: 0,
      max: 600,
      step: 1,
      default: 5,
    }),
  };

  initialState: State = { status: 'idle', rotations: 0, nextInSeconds: 0 };

  #combo: string[] = [];
  // Index of the next step to play. Starting past the end means we begin idle and
  // start the first rotation as soon as the (zero) cooldown elapses.
  #step = 0;
  #nextRotationAt = 0;

  @OnStart()
  start() {
    this.#combo = (this.settings.comboKeys as string)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    this.#step = this.#combo.length;
    this.#nextRotationAt = 0;
    this.setState({ status: 'idle', rotations: 0 });
    this.log.info('Coordinated rotation started.', { combo: this.#combo });
  }

  @OnTick(5)
  async tick() {
    const now = this.ctx.now();

    // Between rotations: wait out the cooldown. We're not driving, so we don't
    // hold the lease — it stays free for any co-running macro on this game.
    if (this.#step >= this.#combo.length) {
      this.setState({
        status: 'idle',
        nextInSeconds: Math.max(0, Math.ceil((this.#nextRotationAt - now) / 1000)),
      });
      if (now < this.#nextRotationAt) return;
      this.#step = 0; // cooldown done — begin a fresh rotation
    }

    // Driving a rotation. Claim the shared input channel for the whole combo so a
    // second macro can't tap a key between our steps. `acquire` also returns false
    // when Roblox isn't focused, so this one check covers both focus and turn-taking.
    if (!this.workflow.acquire('rotation')) {
      this.setState({ status: 'waiting for a turn' });
      return;
    }

    // We're the driver — play the next step of the combo.
    const key = this.#combo[this.#step];
    if (key !== undefined) {
      this.setState({ status: 'rotating' });
      await this.input.tapKey(key);
    }
    this.#step++;

    if (this.#step >= this.#combo.length) {
      // Combo complete. Release any held input and hand the channel back at this
      // clean boundary, then schedule the next rotation.
      await this.input.releaseAll();
      this.workflow.release('rotation');
      this.#nextRotationAt = now + (this.settings.cooldownSeconds as number) * 1000;
      this.setState({ rotations: this.state.rotations + 1 });
    }
  }

  @OnStop()
  async stop() {
    // Always drop input and the lease on stop so a co-running macro isn't left
    // blocked behind us.
    await this.input.releaseAll();
    this.workflow.release('rotation');
    this.log.info('Coordinated rotation stopped.');
  }

  @Action({ id: 'rotateNow', bindable: true, label: 'Rotate now', suggestedKey: 'F8' })
  rotateNow() {
    this.#step = 0;
    this.#nextRotationAt = 0;
  }

  @Panel({ id: 'overview', title: '' })
  overview() {
    return [
      Text('Plays a multi-tick key combo, then idles. Uses the workflow driver so it takes turns with other macros on the same game.'),
      Divider(),
      Row([
        Stat('Status', 'status'),
        Stat('Rotations', 'rotations', { tone: 'ok' }),
        Stat('Next in (s)', 'nextInSeconds', { tone: 'info' }),
      ]),
      Divider(),
      Row([Button('Rotate now', 'rotateNow', { variant: 'outline' })]),
    ];
  }
}
