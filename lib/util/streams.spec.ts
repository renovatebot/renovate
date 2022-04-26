import { Blob } from 'buffer';
import { Readable } from 'stream';
import { streamToString } from './streams';

describe('util/streams', () => {
  describe('streamToString', () => {
    it('handles Blobs', async () => {
      const res = await streamToString(new Blob(['abc', 'zxc']));
      expect(res).toBe('abczxc');
    });

    it('handles Readables', async () => {
      const res = await streamToString(Readable.from(['abc', 'zxc']));
      expect(res).toBe('abczxc');
    });
  });
});
