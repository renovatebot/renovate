import { codeBlock } from 'common-tags';
import { getPkgReleases } from '..';
import { setBaseUrl } from '../../../util/http/github';
import { toBase64 } from '../../../util/string';
import { TypstDatasource } from '.';
import * as httpMock from '~test/http-mock';

const baseUrl = 'https://api.github.com';

const versionsPathFor = (packageName: string): string =>
  `/repos/typst/packages/contents/packages/preview/${packageName}`;

const manifestPathFor = (packageName: string, version: string): string =>
  `/repos/typst/packages/contents/packages/preview/${packageName}/${version}/typst.toml`;

describe('modules/datasource/typst/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      const packageName = 'preview/example-package';

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('example-package'))
        .reply(200, [
          { type: 'dir', name: '0.1.0' },
          { type: 'dir', name: '0.2.0' },
          { type: 'dir', name: '1.0.0' },
        ]);

      const metadata = codeBlock`
        [package]
        name = "example-package"
        version = "1.0.0"
        repository = "https://github.com/example/repo"
      `;

      httpMock
        .scope(baseUrl)
        .get(manifestPathFor('example-package', '1.0.0'))
        .reply(200, {
          content: toBase64(metadata),
          encoding: 'base64',
        });

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        releases: [
          { version: '0.1.0' },
          { version: '0.2.0' },
          { version: '1.0.0' },
        ],
        sourceUrl: 'https://github.com/example/repo',
        registryUrl: 'https://api.github.com',
      });
    });

    it('request package from github.com even on GitHub Enterprise Server', async () => {
      const packageName = 'preview/example-package';
      setBaseUrl('https://github.enterprise.com');

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('example-package'))
        .reply(200, [
          { type: 'dir', name: '0.1.0' },
          { type: 'dir', name: '0.2.0' },
          { type: 'dir', name: '1.0.0' },
        ]);

      const metadata = codeBlock`
        [package]
        name = "example-package"
        version = "1.0.0"
        repository = "https://github.com/example/repo"
      `;

      httpMock
        .scope(baseUrl)
        .get(manifestPathFor('example-package', '1.0.0'))
        .reply(200, {
          content: toBase64(metadata),
          encoding: 'base64',
        });

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        releases: [
          { version: '0.1.0' },
          { version: '0.2.0' },
          { version: '1.0.0' },
        ],
        sourceUrl: 'https://github.com/example/repo',
        registryUrl: 'https://api.github.com',
      });
    });

    it('returns null for unsupported namespace', async () => {
      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName: 'unsupported/example-package',
      });

      expect(res).toBeNull();
    });

    it('returns null when no versions found', async () => {
      const packageName = 'preview/empty-package';

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('empty-package'))
        .reply(200, []);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('filters out invalid versions', async () => {
      const packageName = 'preview/mixed-versions';

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('mixed-versions'))
        .reply(200, [
          { type: 'dir', name: '1.0.0' },
          { type: 'dir', name: 'invalid-version' },
          { type: 'dir', name: '2.0.0' },
        ]);

      const metadata = codeBlock`
        [package]
        name = "mixed-versions"
        version = "2.0.0"
        repository = "https://github.com/example/repo"
      `;

      httpMock
        .scope(baseUrl)
        .get(manifestPathFor('mixed-versions', '2.0.0'))
        .reply(200, {
          content: toBase64(metadata),
          encoding: 'base64',
        });

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
        sourceUrl: 'https://github.com/example/repo',
        registryUrl: 'https://api.github.com',
      });
    });

    it('works without source url when manifest is invalid', async () => {
      const packageName = 'preview/no-source';

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('no-source'))
        .reply(200, [{ type: 'dir', name: '1.0.0' }]);

      httpMock
        .scope(baseUrl)
        .get(manifestPathFor('no-source', '1.0.0'))
        .reply(200, {
          content: toBase64('invalid toml content'),
          encoding: 'base64',
        });

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        releases: [{ version: '1.0.0' }],
        registryUrl: 'https://api.github.com',
      });
    });

    it('works without source url when manifest fetch fails', async () => {
      const packageName = 'preview/manifest-error';

      httpMock
        .scope(baseUrl)
        .get(versionsPathFor('manifest-error'))
        .reply(200, [{ type: 'dir', name: '1.0.0' }]);

      httpMock
        .scope(baseUrl)
        .get(manifestPathFor('manifest-error', '1.0.0'))
        .reply(404);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('returns null when versions fetch fails', async () => {
      const packageName = 'preview/versions-error';

      httpMock.scope(baseUrl).get(versionsPathFor('versions-error')).reply(500);

      await expect(
        getPkgReleases({
          datasource: TypstDatasource.id,
          packageName,
        }),
      ).rejects.toThrow('external-host-error');
    });
  });
});
