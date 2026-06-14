// Memory reader — reads a few values straight from Roblox's memory and shows
// them in a panel. Read-only: the SDK exposes no way to write game memory.
//
// `Roblox.bind` wraps raw process reads with typed instance traversal
// (dataModel / workspace / localPlayer / findFirstChild / text / ...). The
// offset table is supplied by the host as `ctx.offsets` for the running Roblox
// build — you do not ship it, and it is regenerated whenever Roblox updates.

import {
  Chip,
  Divider,
  Macro,
  MacroBase,
  OnStart,
  OnStop,
  OnTick,
  Panel,
  Roblox,
  robloxTarget,
  Row,
  Stat,
  Text,
} from '@nighthawk.hq/macro-sdk';

type State = {
  attached: boolean;
  offsetsOk: boolean;
  playerName: string;
  characterFound: boolean;
  workspaceChildren: number;
  error: string | null;
};

const INITIAL: State = {
  attached: false,
  offsetsOk: false,
  playerName: '—',
  characterFound: false,
  workspaceChildren: 0,
  error: null,
};

@Macro({ target: robloxTarget(), tickTimeoutMs: 500 })
export default class MemoryReaderMacro extends MacroBase<State> {
  initialState: State = INITIAL;

  #rbx: Roblox | null = null;

  @OnStart()
  start() {
    if (!this.process?.attached()) {
      this.setState({ ...INITIAL, error: 'not attached to Roblox' });
      return;
    }
    const rbx = Roblox.bind(this.process, this.ctx.offsets);
    const check = rbx.validate();
    if (!check.ok) {
      this.setState({ ...INITIAL, attached: true, error: check.reason });
      this.log.warn(check.reason, { problems: check.problems });
      return;
    }
    this.#rbx = rbx;
    this.setState({ ...INITIAL, attached: true, offsetsOk: true });
    this.log.success('Attached. Reading game memory (read-only).');
  }

  @OnTick(2)
  tick() {
    const rbx = this.#rbx;
    if (!rbx) return;
    rbx.invalidateCache();

    const localPlayer = rbx.localPlayer();
    const character = rbx.character();
    const workspace = rbx.workspace();

    this.setState({
      playerName: localPlayer?.name() ?? '—',
      characterFound: character !== null,
      workspaceChildren: workspace?.children().length ?? 0,
    });
  }

  @OnStop()
  stop() {
    this.#rbx = null;
    this.setState(INITIAL);
  }

  @Panel({ id: 'overview', title: '' })
  overview() {
    return [
      Text('Values read straight from Roblox memory — read-only.'),
      Divider(),
      Row([Chip('Attached', 'attached', { tone: 'ok' }), Chip('Offsets OK', 'offsetsOk', { tone: 'ok' })]),
      Stat('Local player', 'playerName'),
      Row([
        Chip('Character', 'characterFound', { tone: 'info' }),
        Stat('Workspace children', 'workspaceChildren', { tone: 'info' }),
      ]),
      Stat('Error', 'error'),
    ];
  }
}
