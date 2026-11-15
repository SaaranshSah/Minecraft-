/* Runs every suite in test/ in its own process and aggregates the exit code. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const suites = readdirSync(here)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();

let failed = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const res = spawnSync(process.execPath, [path.join(here, suite)], { stdio: 'inherit' });
  if (res.status !== 0) failed += 1;
}

console.log(`\n${failed ? 'FAILED' : 'PASSED'} — ${suites.length - failed}/${suites.length} suites`);
process.exit(failed ? 1 : 0);
