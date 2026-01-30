import { getPkgReleases } from '../index.ts';
import { TypstDatasource } from './index.ts';
import * as httpMock from '~test/http-mock.ts';

describe('modules/datasource/typst/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      const packageName = 'preview/example-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'example-package',
            version: '0.1.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704708827,
          },
          {
            name: 'example-package',
            version: '0.2.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704808827,
          },
          {
            name: 'example-package',
            version: '1.0.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704908827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        registryUrl: 'https://packages.typst.org/preview/index.json',
        sourceUrl: 'https://github.com/example/repo',
        releases: [
          {
            version: '0.1.0',
            releaseTimestamp: '2024-01-08T10:13:47.000Z',
          },
          {
            version: '0.2.0',
            releaseTimestamp: '2024-01-09T14:00:27.000Z',
          },
          {
            version: '1.0.0',
            releaseTimestamp: '2024-01-10T17:47:07.000Z',
          },
        ],
      });
    });

    it('returns null for unsupported namespace', async () => {
      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName: 'unsupported/example-package',
      });

      expect(res).toBeNull();
    });

    it('returns null when package not found in registry', async () => {
      const packageName = 'preview/nonexistent-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'other-package',
            version: '1.0.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'Another package',
            repository: 'https://github.com/example/other',
            keywords: ['other'],
            updatedAt: 1704708827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('handles multiple versions of the same package', async () => {
      const packageName = 'preview/multi-version';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'multi-version',
            version: '0.1.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'A package with multiple versions',
            repository: 'https://github.com/example/multi',
            keywords: ['multi'],
            updatedAt: 1704708827,
          },
          {
            name: 'multi-version',
            version: '0.2.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'A package with multiple versions',
            repository: 'https://github.com/example/multi',
            keywords: ['multi'],
            updatedAt: 1704808827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        registryUrl: 'https://packages.typst.org/preview/index.json',
        sourceUrl: 'https://github.com/example/multi',
        releases: [
          {
            version: '0.1.0',
            releaseTimestamp: '2024-01-08T10:13:47.000Z',
          },
          {
            version: '0.2.0',
            releaseTimestamp: '2024-01-09T14:00:27.000Z',
          },
        ],
      });
    });

    it('handles registry fetch errors', async () => {
      const packageName = 'preview/error-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(500);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('handles empty registry response', async () => {
      const packageName = 'preview/empty-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, []);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });
  });
});
