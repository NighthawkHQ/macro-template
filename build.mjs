import { buildMacro } from '@nighthawk.hq/macro-sdk/build';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.NIGHTHAWK_MACRO_OUT
  ? resolve(process.env.NIGHTHAWK_MACRO_OUT)
  : join(HERE, 'dist');

// Your macro. Give `id` a unique slug — it becomes the bundle filename.
const MACRO = { id: 'my-macro', entry: join(HERE, 'src', 'index.ts') };

// Reference macros under examples/. Built with `npm run build:examples`.
const EXAMPLES = [
  { id: 'roblox-anti-afk', entry: join(HERE, 'examples', 'roblox', 'anti-afk', 'index.ts') },
  { id: 'roblox-memory-reader', entry: join(HERE, 'examples', 'roblox', 'memory-reader', 'index.ts') },
  { id: 'ui-tour', entry: join(HERE, 'examples', 'ui-tour', 'index.ts') },
];

const targets = process.argv.includes('--examples')
  ? EXAMPLES.map((m) => ({ ...m, outDir: join(outDir, 'examples') }))
  : [{ ...MACRO, outDir }];

for (const { id, entry, outDir: dir } of targets) {
  await buildMacro({ id, entry, outDir: dir, minify: true });
}
