import { Readable } from 'node:stream';
import { streamToString } from './streams';

describe('util/streams', () => {
  describe('streamToString', () => {
    it('handles Readables', async () => {
      const res = await streamToString(Readable.from(['abc', 'zxc']));
      expect(res).toBe('abczxc');
    });
  });
});
