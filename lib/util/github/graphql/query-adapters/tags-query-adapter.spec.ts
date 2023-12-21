import { adapter } from './tags-query-adapter';

describe('util/github/graphql/query-adapters/tags-query-adapter', () => {
  it('transforms Commit type', () => {
    expect(
      adapter.transform({
        version: '1.2.3',
        target: {
          type: 'Commit',
          oid: 'abc123',
          releaseTimestamp: '2022-09-24',
        },
      }),
    ).toEqual({
      version: '1.2.3',
      gitRef: '1.2.3',
      hash: 'abc123',
      releaseTimestamp: '2022-09-24',
    });
  });

  it('transforms Tag type', () => {
    expect(
      adapter.transform({
        version: '1.2.3',
        target: {
          type: 'Tag',
          target: { oid: 'abc123' },
          tagger: { releaseTimestamp: '2022-09-24' },
        },
      }),
    ).toEqual({
      version: '1.2.3',
      gitRef: '1.2.3',
      hash: 'abc123',
      releaseTimestamp: '2022-09-24',
    });
  });

  it('returns null for other types', () => {
    expect(
      adapter.transform({
        target: { type: 'Blob' },
      } as never),
    ).toBeNull();
  });
});
