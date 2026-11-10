import { readdir } from 'node:fs/promises';
import { getTestPatternsForShards } from './test-shards.ts';

describe('tools/test-shards', () => {
  it('expands root-level test globs into CLI filters without nested tests', async () => {
    const rootTests: string[] = [];
    for (const directory of ['lib/modules/datasource', 'lib/modules/manager']) {
      const entries = await readdir(directory, { withFileTypes: true });
      rootTests.push(
        ...entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
          .map((entry) => `${directory}/${entry.name}`),
      );
    }

    const patterns = await getTestPatternsForShards(['versioning']);

    expect(patterns.toSorted()).toEqual(
      ['lib/modules/versioning', ...rootTests].toSorted(),
    );
  });
});
