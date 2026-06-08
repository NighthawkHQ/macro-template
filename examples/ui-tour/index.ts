// UI tour — a tour of the setting kinds, panel widgets, the overlay HUD, and
// bindable actions. No game target and no automation: it just drives state so
// you can see how each piece renders. Use it as a widget reference.

import {
  Action,
  boolean,
  Button,
  Chip,
  Divider,
  Group,
  Macro,
  MacroBase,
  Meter,
  number,
  OnStart,
  OnStop,
  OnTick,
  Overlay,
  Panel,
  Row,
  select,
  Stat,
  string,
  Text,
} from '@nighthawk.hq/macro-sdk';

type State = {
  label: string;
  counter: number;
  progress: number;
  status: string;
  enabled: boolean;
};

const SPEED_BY_MODE: Record<string, number> = { Slow: 0.5, Normal: 1, Fast: 2 };

@Macro()
export default class UiTourMacro extends MacroBase<State> {
  static settings = {
    label: string({ label: 'Display label', default: 'Hello' }),
    speed: number({
      label: 'Speed',
      description: 'How fast the progress meter fills.',
      min: 1,
      max: 10,
      step: 1,
      default: 2,
    }),
    loop: boolean({ label: 'Loop progress', description: 'Wrap back to 0 at 100%.', default: true }),
    mode: select({ label: 'Mode', options: ['Slow', 'Normal', 'Fast'], default: 'Normal' }),
  };

  initialState: State = { label: 'Hello', counter: 0, progress: 0, status: 'idle', enabled: false };

  @OnStart()
  start() {
    this.setState({ status: 'running', enabled: true, counter: 0, progress: 0 });
  }

  @OnTick(5)
  tick() {
    const speed = this.settings.speed as number;
    const mult = SPEED_BY_MODE[this.settings.mode as string] ?? 1;
    let progress = this.state.progress + speed * mult;
    if (progress >= 100) progress = (this.settings.loop as boolean) ? 0 : 100;
    this.setState({
      label: this.settings.label as string,
      counter: this.state.counter + 1,
      progress,
    });
  }

  @OnStop()
  stop() {
    this.setState({ status: 'idle', enabled: false });
  }

  @Action({ id: 'reset', bindable: true, label: 'Reset', suggestedKey: 'F7' })
  reset() {
    this.setState({ counter: 0, progress: 0 });
  }

  @Action({ id: 'bump', label: 'Bump +10' })
  bump() {
    this.setState({ progress: Math.min(100, this.state.progress + 10) });
  }

  @Overlay()
  hud() {
    return [Stat('Status', 'status'), Meter('Progress', 'progress', 0, 100, { tone: 'info' })];
  }

  @Panel({ id: 'overview', title: '' })
  overview() {
    return [
      Text('Edit the settings on the left and watch the panel update.'),
      Divider(),
      Row([
        Stat('Label', 'label'),
        Stat('Counter', 'counter', { tone: 'info' }),
        Chip('Enabled', 'enabled', { tone: 'ok' }),
      ]),
      Meter('Progress', 'progress', 0, 100, { tone: 'ok' }),
      Divider(),
      Row([Button('Reset', 'reset', { variant: 'outline' }), Button('Bump +10', 'bump')]),
    ];
  }

  @Panel({ id: 'about', title: 'About' })
  about() {
    return Group('Shown in this example', [
      Text('Widgets: Stat, Chip, Meter, Button, Text, Row, Group, Divider.'),
      Divider(),
      Text('Settings: string, number, boolean, select.'),
      Text('Plus an overlay HUD and two bindable actions.'),
    ]);
  }
}
