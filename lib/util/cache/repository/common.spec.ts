import { decodePayload, encodePayload } from './common';
import type { RepoCacheData } from './types';

describe('util/cache/repository/common', () => {
  it('performs encoding and decoding', async () => {
    const x: RepoCacheData = {
      semanticCommits: 'disabled',
      scan: {},
    } as never;

    const payload = await encodePayload(x);
    const y = await decodePayload(payload);

    expect(x).toEqual(y);
  });
});
