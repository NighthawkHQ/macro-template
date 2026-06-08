import { buildMacro } from '@nighthawk.hq/macro-sdk/build';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.NIGHTHAWK_MACRO_OUT
  ? resolve(process.env.NIGHTHAWK_MACRO_OUT)
  : join(HERE, 'dist');

// Builds your macro into a single minified bundle. Give `id` a unique slug —
// it becomes the bundle filename (dist/<id>.js).
await buildMacro({ id: 'my-macro', entry: join(HERE, 'src', 'index.ts'), outDir, minify: true });
