import { findRemovedUrls } from './monorepo-urls.ts';

describe('tools/utils/monorepo-urls', () => {
  it('allows adding URLs and presets', () => {
    expect(
      findRemovedUrls(
        { repoGroups: { okhttp: 'https://github.com/square/okhttp' } },
        {
          repoGroups: {
            okhttp: [
              'https://github.com/square/okhttp',
              'https://github.com/lysine-dev/okhttp',
            ],
            okio: 'https://github.com/lysine-dev/okio',
          },
        },
      ),
    ).toEqual([]);
  });

  it('reports a replaced string URL', () => {
    expect(
      findRemovedUrls(
        { repoGroups: { okhttp: 'https://github.com/square/okhttp' } },
        { repoGroups: { okhttp: 'https://github.com/lysine-dev/okhttp' } },
      ),
    ).toEqual(['repoGroups.okhttp: https://github.com/square/okhttp']);
  });

  it('reports a URL dropped from an array in orgGroups', () => {
    expect(
      findRemovedUrls(
        { orgGroups: { a: ['https://x/a', 'https://x/b'] } },
        { orgGroups: { a: 'https://x/b' } },
      ),
    ).toEqual(['orgGroups.a: https://x/a']);
  });

  it('ignores removed presets', () => {
    expect(
      findRemovedUrls({ repoGroups: { a: 'https://x/a' } }, { repoGroups: {} }),
    ).toEqual([]);
  });
});
