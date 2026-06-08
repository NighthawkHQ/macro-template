// Starter macro — the one that `npm run build` bundles. Edit this file (or
// replace it) to build your own. It has no target, so the runtime does not
// attach to any game and input is disabled; to automate a game add
// `target: robloxTarget()` to @Macro and see examples/roblox/anti-afk.

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
  Row,
  Stat,
} from '@nighthawk.hq/macro-sdk';

type State = {
  running: boolean;
  ticks: number;
};

@Macro()
export default class StarterMacro extends MacroBase<State> {
  static settings = {
    step: number({
      label: 'Step',
      description: 'Amount the counter advances each tick.',
      min: 1,
      max: 100,
      step: 1,
      default: 1,
    }),
  };

  initialState: State = { running: false, ticks: 0 };

  @OnStart()
  start() {
    this.setState({ running: true, ticks: 0 });
    this.log.info('Starter macro started.');
  }

  @OnTick(5)
  tick() {
    // TODO: your automation goes here.
    const step = this.settings.step as number;
    this.setState({ ticks: this.state.ticks + step });
  }

  @OnStop()
  stop() {
    this.setState({ running: false });
    this.log.info('Starter macro stopped.');
  }

  @Action({ id: 'reset', bindable: true, label: 'Reset counter' })
  reset() {
    this.setState({ ticks: 0 });
  }

  @Panel({ id: 'overview', title: '' })
  overview() {
    return [
      Row([Stat('Running', 'running'), Stat('Ticks', 'ticks', { tone: 'info' })]),
      Divider(),
      Row([Button('Reset counter', 'reset', { variant: 'outline' })]),
    ];
  }
}
