import { Repodata } from './schema.ts';

describe('modules/datasource/conda/schema', () => {
  describe('Repodata', () => {
    it('keeps a build whose timestamp is not a number', () => {
      const res = Repodata.parse({
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

    it('drops a build without a name or version', () => {
      const res = Repodata.parse({
        packages: {
          'a-1.0.0-h0.tar.bz2': { version: '1.0.0' },
          'b-1.0.0-h0.tar.bz2': { name: 'b' },
          'c-1.0.0-h0.tar.bz2': { name: 'c', version: '1.0.0' },
        },
      });

      expect([...res.keys()]).toEqual(['c']);
    });

    it('treats a section that is not an object as empty', () => {
      const res = Repodata.parse({
        packages: null,
        'packages.conda': {
          'a-1.0.0-h0.conda': { name: 'a', version: '1.0.0' },
        },
      });

      expect([...res.keys()]).toEqual(['a']);
    });

    it('returns an empty index for a document that is not repodata', () => {
      expect(Repodata.parse({ errors: ['unauthorized'] }).size).toBe(0);
    });

    it('reports the earliest timestamp across both sections', () => {
      const res = Repodata.parse({
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
  });
});
