import { gzipSync } from 'node:zlib';
import { codeBlock } from 'common-tags';
import * as httpMock from '~test/http-mock.ts';
import { RpmDatasource } from './index.ts';

const registryUrl = 'https://example.com/repo/repodata/';
const primaryXmlUrl =
  'https://example.com/repo/repodata/somesha256-primary.xml.gz';

describe('modules/datasource/rpm/index', () => {
  describe('getPrimaryGzipUrl', () => {
    const rpmDatasource = new RpmDatasource();

    it('returns the correct primary.xml URL', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      const resolvedPrimaryXmlUrl =
        await rpmDatasource.getPrimaryGzipUrl(registryUrl);

      expect(resolvedPrimaryXmlUrl).toBe(primaryXmlUrl);
    });

    it('returns the correct primary.xml URL when repomd.xml omits xml declaration', async () => {
      const repomdXml = codeBlock`
        <repomd xmlns="http://linux.duke.edu/metadata/repo"
          xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      const resolvedPrimaryXmlUrl =
        await rpmDatasource.getPrimaryGzipUrl(registryUrl);

      expect(resolvedPrimaryXmlUrl).toBe(primaryXmlUrl);
    });

    it('throws an error if repomd.xml is missing', async () => {
      httpMock.scope(registryUrl).get('/repomd.xml').reply(404, 'Not Found');

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(
        `Request failed with status code 404 (Not Found): GET ${registryUrl}repomd.xml`,
      );
    });

    it('throws an error if http.getText fails', async () => {
      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .replyWithError('Network error');

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow('Network error');
    });

    it('throws an error if repomdXml is not in XML format', async () => {
      const repomdXml = codeBlock`
        <?invalidxml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`is not in XML format.`);
    });

    it('throws an error if no primary data is found', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="non-primary">
            <location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`No primary data found in ${registryUrl}repomd.xml`);
    });

    it('throws an error if no location element is found', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <non-location href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(
        `No location element found in ${registryUrl}repomd.xml`,
      );
    });

    it('throws an error if location href is missing', async () => {
      const repomdXml = codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
          <data type="primary">
            <location non-href="repodata/somesha256-primary.xml.gz"/>
          </data>
        </repomd>
      `;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getPrimaryGzipUrl(registryUrl),
      ).rejects.toThrow(`No href found in ${registryUrl}repomd.xml`);
    });
  });

  describe('getReleasesByPackageName', () => {
    const packageName = 'example-package';
    const rpmDatasource = new RpmDatasource();
    const primaryXmlRegistryUrl = primaryXmlUrl.replace(/\/[^/]+$/, '');

    function buildPrimaryXml(packageEntries: string): string {
      return codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <metadata xmlns="http://linux.duke.edu/metadata/common">
          ${packageEntries}
        </metadata>
      `;
    }

    function mockPrimaryXmlResponse(primaryXml: string): void {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(200, gzipSync(primaryXml), {
          'Content-Type': 'application/gzip',
        });
    }

    it('returns the correct releases', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.1" rel="1.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.1" rel="2.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.2"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toEqual({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });
    });

    it('throws an error if somesha256-primary.xml.gz is not found', async () => {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(404, 'Not Found');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrow(
        `Request failed with status code 404 (Not Found): GET ${primaryXmlUrl}`,
      );
    });

    it('throws an error if response.body is empty', async () => {
      httpMock
        .scope(primaryXmlRegistryUrl)
        .get('/somesha256-primary.xml.gz')
        .reply(200, '', { 'Content-Type': 'application/gzip' });

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrow(`Empty response body from getting ${primaryXmlUrl}.`);
    });

    it('rethrows non-Error fetch failures', async () => {
      vi.spyOn(
        (
          rpmDatasource as unknown as {
            http: { getBuffer: (url: string) => unknown };
          }
        ).http,
        'getBuffer',
      ).mockRejectedValue('boom');

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toBe('boom');
    });

    it('returns null if no element package is found in primary.xml', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <nonpackage type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </nonpackage>
        `),
      );

      const result = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(result).toBeNull();
    });

    it('returns null if the specific packageName is not found in primary.xml', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>wrong-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      expect(
        await rpmDatasource.getReleasesByPackageName(
          primaryXmlUrl,
          packageName,
        ),
      ).toBeNull();
    });

    it('returns null if version is not found in a version element', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <non-version epoch="0" ver="1.0" rel="2.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toBeNull();
    });

    it('returns null if version element is missing the ver attribute', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" rel="2.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toBeNull();
    });

    it('returns an array of releases without duplicate versionWithRel', async () => {
      mockPrimaryXmlResponse(
        buildPrimaryXml(codeBlock`
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
        `),
      );

      const releases = await rpmDatasource.getReleasesByPackageName(
        primaryXmlUrl,
        packageName,
      );

      expect(releases).toEqual({
        releases: [{ version: '1.0-dulp.azl3' }],
      });
    });

    it('handles parser error event in getReleasesByPackageName', async () => {
      mockPrimaryXmlResponse(codeBlock`
        <?xml version="1.0" encoding="UTF-8"?>
        <%$#metadata xmlns="http://linux.duke.edu/metadata/common">
          <package type="rpm">
            <name>example-package</name>
            <arch>x86_64</arch>
            <version epoch="0" ver="1.0" rel="dulp.azl3"/>
          </package>
        </metadata>
      `);

      await expect(
        rpmDatasource.getReleasesByPackageName(primaryXmlUrl, packageName),
      ).rejects.toThrowError('Unencoded <');
    });
  });

  describe('getReleases', () => {
    const rpmDatasource = new RpmDatasource();

    it('returns null if registryUrl is not provided', async () => {
      const releases = await rpmDatasource.getReleases({
        registryUrl: undefined,
        packageName: 'example-package',
      });

      expect(releases).toBeNull();
    });

    it('returns null if packageName is not provided', async () => {
      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: '',
      });

      expect(releases).toBeNull();
    });

    it('returns the correct releases', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockResolvedValue(
        primaryXmlUrl,
      );
      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockResolvedValue({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });

      expect(releases).toEqual({
        releases: [
          { version: '1.0-2.azl3' },
          { version: '1.1-1.azl3' },
          { version: '1.1-2.azl3' },
          { version: '1.2' },
        ],
      });
    });

    it('throws an error if getPrimaryGzipUrl fails', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockRejectedValue(
        new Error('Something wrong'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Something wrong');
    });

    it('throws an error if getReleasesByPackageName fails', async () => {
      vi.spyOn(rpmDatasource, 'getPrimaryGzipUrl').mockResolvedValue(
        primaryXmlUrl,
      );
      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockRejectedValue(
        new Error('Something wrong'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Something wrong');
    });
  });
});
