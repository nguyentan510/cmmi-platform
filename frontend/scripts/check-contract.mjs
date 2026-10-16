import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const directory = mkdtempSync(join(tmpdir(), 'cmmi-contract-'));
try {
  const output = join(directory, 'api.d.ts');
  execFileSync(
    process.execPath,
    [resolve('node_modules/openapi-typescript/bin/cli.js'), '../shared/openapi.json', '-o', output],
    { stdio: 'inherit' },
  );
  if (
    readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !==
    readFileSync('src/types/api.d.ts', 'utf8').replaceAll('\r\n', '\n')
  ) {
    throw new Error('Frontend contract is stale. Run npm run generate:api.');
  }
  console.log('Frontend types match shared/openapi.json.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
