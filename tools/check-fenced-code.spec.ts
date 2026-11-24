import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

const checker = fileURLToPath(
  new URL('./check-fenced-code.ts', import.meta.url),
);

describe('tools/check-fenced-code', () => {
  let cwd: string;

  function check(...files: string[]) {
    return execa(process.execPath, [checker, ...files], { cwd, reject: false });
  }

  beforeAll(async () => {
    cwd = await mkdtemp(path.join(os.tmpdir(), 'renovate-doc-fence-test-'));
    await mkdir(path.join(cwd, 'docs'));
    await mkdir(path.join(cwd, 'lib'));

    await writeFile(
      path.join(cwd, 'docs', 'good.md'),
      '```js\nmodule.exports = {};\n```\n\n```json\n{}\n```\n',
    );
    const badJs = '```javascript\nmodule.exports = ;\n```\n';
    await writeFile(path.join(cwd, 'docs', '[bad].md'), badJs);
    await writeFile(path.join(cwd, 'lib', 'readme.md'), badJs);
    await writeFile(path.join(cwd, 'lib', 'notes.md'), badJs);
    await writeFile(path.join(cwd, 'bad-json.md'), '```json\n{\n```\n');
    await writeFile(path.join(cwd, 'example.txt'), 'Not Markdown');
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('checks only the named files', async () => {
    const result = await check('docs/good.md', 'lib/notes.md');

    expect(result.exitCode).toBe(0);
  });

  it('reports JavaScript and JSON errors for literal paths', async () => {
    const docsFile = './docs/[bad].md';
    const libFile = path.join(cwd, 'lib', 'readme.md');

    const result = await check(docsFile, libFile, 'bad-json.md');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(docsFile);
    expect(result.stderr).toContain(libFile);
    expect(result.stderr).toContain('bad-json.md');
    expect(result.stderr).toContain('3 issues found.');
  });

  it('rejects non-Markdown arguments', async () => {
    const result = await check('example.txt');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Expected a Markdown (.md) file: example.txt',
    );
  });

  it('scans docs and lib when no files are given', async () => {
    const result = await check();

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('docs/[bad].md');
    expect(result.stderr).toContain('lib/readme.md');
    expect(result.stderr).toContain('2 issues found.');
  });
});
