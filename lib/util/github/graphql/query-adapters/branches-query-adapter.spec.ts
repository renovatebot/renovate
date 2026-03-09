import type { Timestamp } from '../../../../util/timestamp.ts';
import { adapter } from './branches-query-adapter.ts';

describe('util/github/graphql/query-adapters/branches-query-adapter', () => {
  it('transforms Commit type', () => {
    expect(
      adapter.transform({
        version: 'main',
        target: {
          type: 'Commit',
          oid: 'abc123',
          releaseTimestamp: '2022-09-24' as Timestamp,
        },
      }),
    ).toEqual({
      version: 'main',
      gitRef: 'main',
      hash: 'abc123',
      releaseTimestamp: '2022-09-24' as Timestamp,
    });
  });

  it('returns null for invalid input', () => {
    expect(
      adapter.transform({
        target: { type: 'Blob' },
      } as never),
    ).toBeNull();
  });
});
