import { readFile, readdir } from 'node:fs/promises';
import upath from 'upath';

describe('other/validate-workflows', () => {
  it('references the workflow token as github.token', async () => {
    const files = (await readdir('.github', { recursive: true })).filter(
      (file) => file.endsWith('.yml') || file.endsWith('.yaml'),
    );
    const contents = await Promise.all(
      files.map(async (file) => ({
        file,
        content: await readFile(upath.join('.github', file), 'utf8'),
      })),
    );

    const offending = contents
      .filter(({ content }) => content.includes('secrets.GITHUB_TOKEN'))
      .map(({ file }) => file);

    expect(offending).toBeEmptyArray();
  });
});
