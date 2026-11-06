import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(frontendDir, '..');
const windows = process.platform === 'win32';
const localPython = path.join(
  rootDir,
  'backend',
  '.venv',
  windows ? 'Scripts/python.exe' : 'bin/python',
);
const python =
  process.env.PYTHON || (existsSync(localPython) ? localPython : windows ? 'python' : 'python3');
const result = spawnSync(
  python,
  ['-m', 'unittest', 'discover', '-s', 'backend', '-p', 'test*.py', '-v'],
  {
    cwd: rootDir,
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(`Could not start Python (${python}): ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
