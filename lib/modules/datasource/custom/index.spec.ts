import { codeBlock, html } from 'common-tags';
import { getPkgReleases } from '..';
import { logger } from '../../../logger';
import { CustomDatasource } from './index';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/datasource/custom/index', () => {
  describe('getReleases', () => {
    it('return null if only the prefix is supplied', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.`,
        packageName: '*',
        customDatasources: {},
      });
      expect(result).toBeNull();
    });

    it('return null if no registryUrl is provided as well no defaultRegistryTemplate is defined', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {},
        },
      });
      expect(result).toBeNull();
    });

    it('return null if no custom datasource could  be found', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: '*',
        customDatasources: {},
      });
      expect(result).toBeNull();
    });

    it('return null on http error', async () => {
      httpMock.scope('https://example.com').get('/v1').reply(404);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'aPackageName',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('return null if schema validation fails', async () => {
      httpMock.scope('https://example.com').get('/v1').reply(200, {
        version: 'v1.0.0',
      });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('return releases for api directly exposing in renovate format', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, expected);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases with digests for api directly exposing in renovate format', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
            newDigest: '0123456789abcdef',
          },
        ],
      };
      const content = {
        releases: [
          {
            version: 'v1.0.0',
            digest: '0123456789abcdef',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, content);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases with tags and other optional fields for api directly exposing in renovate format', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
        tags: {
          latest: 'v1.0.0',
        },
        sourceUrl: 'https://example.com/foo.git',
        sourceDirectory: '/',
        changelogUrl: 'https://example.com/foo/blob/main/CHANGELOG.md',
        homepage: 'https://example.com/foo',
      };
      const content = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
        tags: {
          latest: 'v1.0.0',
        },
        sourceUrl: 'https://example.com/foo.git',
        sourceDirectory: '/',
        changelogUrl: 'https://example.com/foo/blob/main/CHANGELOG.md',
        homepage: 'https://example.com/foo',
        unknown: {},
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, content);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for plain text API directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0\n2.0.0\n3.0.0', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for plain text API and trim the content', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0 \n2.0.0 \n 3.0.0 ', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('returns null if transformation compilation using jsonata fails', async () => {
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0 \n2.0.0 \n 3.0.0 ', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['$[.name = "Alice" and'],
            format: 'plain',
          },
        },
      });
      expect(result).toBeNull();
      expect(logger.once.warn).toHaveBeenCalledWith(
        { errorMessage: 'The symbol "." cannot be used as a unary operator' },
        'Invalid JSONata expression: $[.name = "Alice" and',
      );
    });

    it('returns null if jsonata expression evaluation fails', async () => {
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0 \n2.0.0 \n 3.0.0 ', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['$notafunction()'],
            format: 'plain',
          },
        },
      });
      expect(result).toBeNull();
      expect(logger.once.warn).toHaveBeenCalledWith(
        { err: expect.any(Object) },
        'Error while evaluating JSONata expression: $notafunction()',
      );
    });

    it('return releases for plain text API when only returns a single version', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, '1.0.0', {
        'Content-Type': 'text/plain',
      });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for yaml API directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };

      const yaml = codeBlock`
        releases:
          - version: 1.0.0
          - version: 2.0.0
          - version: 3.0.0
      `;

      httpMock.scope('https://example.com').get('/v1').reply(200, yaml, {
        'Content-Type': 'text/yaml',
      });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'yaml',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for yaml file directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        releases:
          - version: 1.0.0
          - version: 2.0.0
          - version: 3.0.0
      `);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.yaml',
            format: 'yaml',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for json file directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`{
        "releases": [
          { "version": "1.0.0" },
          { "version": "2.0.0" },
          { "version": "3.0.0" }
        ]
      }`);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.json',
            format: 'json',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return null for plain text file if the body is not what is expected', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.version',
            format: 'plain',
          },
        },
      });

      expect(result).toBeNull();
    });

    it('return releases for plain text file directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`{
        1.0.0
        2.0.0
        3.0.0
      }`);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.version',
            format: 'plain',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return release when templating registryUrl', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1/myPackage')
        .reply(200, expected);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate:
              'https://example.com/v1/{{packageName}}',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return release with templated path', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };

      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, {
          myPackage: expected,
          otherPackage: {
            releases: [
              {
                version: 'v2.0.0',
              },
            ],
          },
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['{{packageName}}'],
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return release with templated path with multiple layers', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };

      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, {
          groupName: {
            myPackage: expected,
            otherPackage: {
              releases: [
                {
                  version: 'v2.0.0',
                },
              ],
            },
          },
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['groupName.{{packageName}}'],
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases from HTML links', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
          <body>
            <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
          </body>
        </html>
      `;

      httpMock
        .scope('https://example.com')
        .get('/index.html')
        .reply(200, content, {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/index.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases from HTML links - local file', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
          <body>
            <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
          </body>
        </html>
      `;

      fs.readLocalFile.mockResolvedValueOnce(content);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return null for local file read error - HTML format', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.html',
            format: 'html',
          },
        },
      });

      expect(result).toBeNull();
    });

    it('return releases from nginx directory listing', async () => {
      const expected = {
        releases: [
          {
            version: 'nginx-0.1.0.tar.gz',
          },
          {
            version: 'nginx-0.1.1.tar.gz',
          },
          {
            version: 'nginx-0.1.11.tar.gz',
          },
        ],
      };

      httpMock
        .scope('http://nginx.org')
        .get('/download/')
        .reply(200, Fixtures.get('nginx-downloads.html'), {
          'Content-Type': 'text/html',
        })
        .get('/download')
        .reply(301, undefined, {
          Location: 'http://nginx.org/download/',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'http://nginx.org/download',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for malformed HTML', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
        <body>
        <h1></pre><hr></body><a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
        </html>
      `;

      httpMock
        .scope('https://example.com')
        .get('/malformed.html')
        .reply(200, content, {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/malformed.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for incomplete HTML', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
        <body>
        <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
        <a href="package-2.0.tar.gz
      `;

      httpMock
        .scope('https://example.com')
        .get('/incomplete.html')
        .reply(200, content, {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/incomplete.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });
  });

  describe('getDigest', () => {
    it('returns null as digest should be provided in releases', async () => {
      const digest = await new CustomDatasource().getDigest({
        packageName: 'my-package',
      });
      expect(digest).toBeNull();
    });
  });
});
