import { Readable } from 'node:stream';
import { coerceArray } from '../../../util/array.ts';
import { parseRepodataStream } from './repodata-index.ts';

function parse(doc: unknown, chunkSize?: number): Promise<Map<string, any>> {
  const json = JSON.stringify(doc);
  const chunks = chunkSize
    ? coerceArray(json.match(new RegExp(`.{1,${chunkSize}}`, 'gs')))
    : [json];
  return parseRepodataStream(Readable.from(chunks));
}

describe('modules/datasource/conda/repodata-index', () => {
  describe('parseRepodataStream', () => {
    it('keeps a build whose timestamp is not a number', async () => {
      const res = await parse({
        packages: {
          'a-1.0.0-h0.tar.bz2': {
            name: 'a',
            version: '1.0.0',
            timestamp: null,
          },
          'a-1.1.0-h0.tar.bz2': {
            name: 'a',
            version: '1.1.0',
            timestamp: '1700000000000',
          },
        },
      });

      expect([...res.get('a')!.values()]).toEqual([
        { version: '1.0.0' },
        { version: '1.1.0' },
      ]);
    });

    it('drops a build without a name or version', async () => {
      const res = await parse({
        packages: {
          'a-1.0.0-h0.tar.bz2': { version: '1.0.0' },
          'b-1.0.0-h0.tar.bz2': { name: 'b' },
          'c-1.0.0-h0.tar.bz2': { name: 'c', version: '1.0.0' },
        },
      });

      expect([...res.keys()]).toEqual(['c']);
    });

    it('treats a section that is not an object as empty', async () => {
      const res = await parse({
        packages: null,
        'packages.conda': {
          'a-1.0.0-h0.conda': { name: 'a', version: '1.0.0' },
        },
      });

      expect([...res.keys()]).toEqual(['a']);
    });

    it('ignores the sections that do not hold builds', async () => {
      const res = await parse({
        info: { subdir: 'linux-64' },
        repodata_version: 1,
        removed: ['a-1.0.0-h0.tar.bz2'],
        packages: { 'b-1.0.0-h0.tar.bz2': { name: 'b', version: '1.0.0' } },
      });

      expect([...res.keys()]).toEqual(['b']);
    });

    it('returns an empty index for a document that is not repodata', async () => {
      const res = await parse({ errors: ['unauthorized'] });

      expect(res.size).toBe(0);
    });

    it('reports the earliest timestamp across both sections', async () => {
      const res = await parse({
        packages: {
          'a-1.0.0-h0.tar.bz2': {
            name: 'a',
            version: '1.0.0',
            timestamp: 1719000000000,
          },
        },
        'packages.conda': {
          'a-1.0.0-h1.conda': {
            name: 'a',
            version: '1.0.0',
            timestamp: 1700000000000,
          },
          'a-1.0.0-h2.conda': {
            name: 'a',
            version: '1.0.0',
            timestamp: 1718000000000,
          },
        },
      });

      expect(res.get('a')!.get('1.0.0')).toEqual({
        version: '1.0.0',
        releaseTimestamp: '2023-11-14T22:13:20.000Z',
      });
    });

    it('reassembles build records split across chunk boundaries', async () => {
      // one byte at a time, so every record spans many writes
      const res = await parse(
        {
          packages: {
            'a-1.0.0-h0.tar.bz2': {
              name: 'a',
              version: '1.0.0',
              timestamp: 1700000000000,
            },
          },
          'packages.conda': {
            'b-2.0.0-h0.conda': { name: 'b', version: '2.0.0' },
          },
        },
        1,
      );

      expect(res.get('a')!.get('1.0.0')).toEqual({
        version: '1.0.0',
        releaseTimestamp: '2023-11-14T22:13:20.000Z',
      });
      expect(res.get('b')!.get('2.0.0')).toEqual({ version: '2.0.0' });
    });

    it('throws for a document that is not JSON', async () => {
      await expect(
        parseRepodataStream(Readable.from(['this is not repodata'])),
      ).rejects.toThrow('Unexpected "h"');
    });
  });
});
