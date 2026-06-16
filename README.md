# Nighthawk Macro Template

A starting point for building macros that run inside the Nighthawk desktop
client. A macro is a small TypeScript class that declares some settings and a
few lifecycle hooks; the build step bundles it into a single minified file that
the client loads, sandboxes, and runs.

## Quick start

```bash
npm install
npm run build          # bundles src/index.ts → dist/my-macro.js (minified)
```

Then edit [src/index.ts](src/index.ts) — that's your macro. Rebuild to produce a
fresh `dist/<id>.js`. The bundle filename comes from the `id` in
[build.mjs](build.mjs); rename it to something unique for your macro.

```bash
npm run typecheck      # type-checks src/ and the examples
```

`npm run build` only builds your macro in `src/`. The `examples/` are reference
source to read and copy from — they are not built.

The build externalizes the SDK: the runtime (decorators, widgets, memory
access) is provided by the host at load time, so it is never bundled into your
macro. Keep the bundle small — the host rejects bundles over 256 KB.

## Project structure

```text
src/index.ts            your macro (what `npm run build` ships)
build.mjs               bundles a macro entry → dist/<id>.js, minified
tsconfig.json           TypeScript config (standard decorators, strict)
examples/
  roblox/anti-afk/             tap the jump key on a timer (input only)
  roblox/memory-reader/        read values from Roblox memory (read-only)
  roblox/coordinated-rotation/ take turns with other macros (workflow driver)
  ui-tour/                     every setting kind, widget, overlay, and action
```

## Anatomy of a macro

A macro is a `default export` class that extends `MacroBase` and is annotated
with `@Macro`. Methods are wired up with decorators:

| Decorator | Purpose |
| --- | --- |
| `@Macro({ target?, tickTimeoutMs? })` | Marks the class. `target` attaches the macro to a game (see below). |
| `@OnStart()` | Runs once when the macro starts. |
| `@OnTick(hz)` | Runs `hz` times per second while running. |
| `@OnStop()` | Runs once when the macro stops. |
| `@Action({ id, bindable?, label?, suggestedKey? })` | A user-triggerable command; `bindable` ones can be bound to a hotkey. |
| `@Panel({ id, title })` | Returns the widget layout for a tab in the macro's UI. |
| `@Overlay()` | Returns a compact widget layout drawn over the game. |

Inside the class you have `this.settings`, `this.state` / `this.setState(...)`,
`this.log`, `this.input`, `this.process`, and `this.ctx`.

### Settings

Declare settings as a `static settings` object. Each one renders an input in the
macro's settings panel and shows up on `this.settings`:

```ts
static settings = {
  intervalSeconds: number({ label: 'Interval', min: 1, max: 600, default: 60 }),
  enabled: boolean({ label: 'Enabled', default: true }),
  key: string({ label: 'Key', default: 'space' }),
  mode: select({ label: 'Mode', options: ['Slow', 'Fast'], default: 'Slow' }),
};
```

Kinds: `number`, `boolean`, `string`, `select`, plus `point`, `color`, `region`,
`ratio`, `pixelColor`, `findColor` for screen work. Read them with
`this.settings.intervalSeconds as number`.

### State and panels

State is a plain object you publish with `this.setState(...)`. Widgets bind to
state fields by name, so the UI updates as state changes:

```ts
@Panel({ id: 'overview', title: '' })
overview() {
  return [
    Row([Stat('Jumps', 'jumps'), Stat('Next in (s)', 'nextInSeconds')]),
    Button('Jump now', 'jumpNow', { variant: 'outline' }),
  ];
}
```

Widgets: `Stat`, `Chip`, `Meter`, `Button`, `Text`, `Image`, `Row`, `Group`,
`Divider`.

## Sending input

`this.input` exposes `tapKey`, `holdKey`, `mouseDown`/`mouseUp`, `click`, `move`,
`releaseAll`. Input is **foreground-gated**: it only fires while the targeted
game window owns focus, and a macro with **no target cannot send input at all**.
So any macro that presses keys or clicks must declare a game target:

```ts
@Macro({ target: robloxTarget() })
```

See [examples/roblox/anti-afk](examples/roblox/anti-afk/index.ts).

## Reading game memory

With a `robloxTarget()`, the host attaches to Roblox and you can read its memory
through the typed adapter:

```ts
const rbx = Roblox.bind(this.process, this.ctx.offsets);
const check = rbx.validate();
if (!check.ok) {
  // check.reason is a ready-to-surface message (Roblox closed / not in a game /
  // stale offsets); check.problems holds the diagnostic detail for logs.
  this.log.warn(check.reason, { problems: check.problems });
  return;
}
const name = rbx.localPlayer()?.name();
```

`Roblox.bind` gives you `dataModel()`, `workspace()`, `localPlayer()`,
`character()`, `findFirstChild()`, `text()`, and more. The offset table comes
from the host as `this.ctx.offsets` for the running Roblox build — you don't
ship offsets, and they're regenerated whenever Roblox updates. See
[examples/roblox/memory-reader](examples/roblox/memory-reader/index.ts).

Memory access is **read-only** by design. There is no API to write game memory.

## Coordinating with other macros

Several macros can run on one game at the same time, but they all share **one
cursor and one keyboard**. If two of them send input at once they fight — one
yanks the cursor mid-cast of the other, or a keypress lands in the wrong place.

The **workflow driver** fixes this by letting macros take turns at the
granularity of a whole **multi-tick activity** — a full cast→reel cycle, a key
combo, a feeding sequence — not individual presses. Use it whenever one logical
action spans more than one tick *and* another macro might run on the same game.
A single self-contained tap (like anti-afk) doesn't need it.

It's two calls on `this.workflow`:

```ts
@OnTick(5)
async tick() {
  // Claim the shared input channel for this whole activity. Returns false when
  // another macro is driving OR the game isn't focused — either way, wait your
  // turn. One check covers both focus and turn-taking.
  if (!this.workflow.acquire('rotation')) return;

  // …you're the driver — run your multi-tick sequence across this and the next
  // few ticks. As long as you keep calling acquire() each tick, no other macro
  // can interrupt you halfway…

  // When the activity finishes, drop any held input and hand off at this clean
  // boundary so another macro gets a turn:
  await this.input.releaseAll();
  this.workflow.release('rotation');
}
```

`acquire(name)` is the gate you call every driving tick; `release(name)` hands
the channel back immediately at a safe boundary instead of waiting to be timed
out. Always `releaseAll()` before you release — otherwise the next macro starts
with a key stuck down. A macro that runs alone always gets `true`, so adding the
gate is safe even if your macro usually runs solo. See
[examples/roblox/coordinated-rotation](examples/roblox/coordinated-rotation/index.ts).

## Examples

- **[roblox/anti-afk](examples/roblox/anti-afk/index.ts)** — taps the jump key
  on a timer with optional jitter; input only, no memory.
- **[roblox/memory-reader](examples/roblox/memory-reader/index.ts)** — attaches
  to Roblox and reads the local player and workspace; read-only.
- **[roblox/coordinated-rotation](examples/roblox/coordinated-rotation/index.ts)** —
  plays a multi-tick key combo and uses the workflow driver (`acquire`/`release`)
  to take turns with other macros on the same game.
- **[ui-tour](examples/ui-tour/index.ts)** — every setting kind, the panel
  widgets, an overlay HUD, and bindable actions, with no game target.
