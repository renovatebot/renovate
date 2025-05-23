import { RpmDatasource } from '.';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/rpm/index', () => {
  const testReleases = {
    releases: [
      {
        version: '1.0-2.azl3',
      },
      {
        version: '1.1-1.azl3',
      },
      {
        version: '1.1-2.azl3',
      },
      {
        version: '1.2',
      },
    ],
  };
  describe('getFilelistsXmlUrl', () => {
    const registryUrl = 'https://example.com/repo/repodata/';
    let rpmDatasource: RpmDatasource;
    beforeEach(() => {
      rpmDatasource = new RpmDatasource();
    });

    it('returns the correct filelists.xml URL', async () => {
      const repomdXml = `<?xml version="1.0" encoding="UTF-8"?>
<repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
  <data type="primary">
    <other name="other stuff"/>
  </data>
  <data type="filelists">
    <location href="repodata/somesha256-filelists.xml.gz"/>
  </data>
</repomd>`;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'text/xml' });

      const filelistsXmlUrl =
        await rpmDatasource.getFilelistsXmlUrl(registryUrl);

      expect(filelistsXmlUrl).toBe(
        'https://example.com/repo/repodata/somesha256-filelists.xml.gz',
      );
    });

    it('throws an error if repomd.xml is missing', async () => {
      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .replyWithError('Network error');

      await expect(
        rpmDatasource.getFilelistsXmlUrl(registryUrl),
      ).rejects.toThrow(`Network error`);
    });

    it('returns null if no filelists data is found', async () => {
      const repomdXml = `<?xml version="1.0" encoding="UTF-8"?>
<repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
  <data type="non-filelists">
    <location href="repodata/somesha256-filelists.xml.gz"/>
  </data>
</repomd>`;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      expect(await rpmDatasource.getFilelistsXmlUrl(registryUrl)).toBeNull();
    });

    it('throws an error if location href is missing', async () => {
      const repomdXml = `<?xml version="1.0" encoding="UTF-8"?>
<repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
  <data type="filelists">
    <location non-href="repodata/somesha256-filelists.xml.gz"/>
  </data>
</repomd>`;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'application/xml' });

      await expect(
        rpmDatasource.getFilelistsXmlUrl(registryUrl),
      ).rejects.toThrow(`No href found in filelists.xml`);
    });
  });

  describe('getReleasesByPackageName', () => {
    const packageName = 'example-package';
    let rpmDatasource: RpmDatasource;
    let filelistsXmlUrl: string;
    beforeEach(() => {
      rpmDatasource = new RpmDatasource();
      filelistsXmlUrl =
        'https://example.com/repo/repodata/somesha256-filelists.xml.gz';
    });

    it('returns the correct releases', async () => {
      const filelistsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<filelists xmlns="http://linux.duke.edu/metadata/filelists">
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.0" rel="2.azl3"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.1" rel="1.azl3"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.1" rel="2.azl3"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.2"/>
    <file>example-file</file>
  </package>
</filelists>
`;
      httpMock
        .scope(filelistsXmlUrl.replace(/\/[^/]+$/, ''))
        .get('/somesha256-filelists.xml.gz')
        .reply(200, filelistsXml, { 'Content-Type': 'text/xml' });
      const releases = await rpmDatasource.getReleasesByPackageName(
        filelistsXmlUrl,
        packageName,
      );
      expect(releases).toEqual(testReleases);
    });

    it('throws an error if filelists.xml is missing', async () => {
      httpMock
        .scope(filelistsXmlUrl.replace(/\/[^/]+$/, ''))
        .get('/somesha256-filelists.xml.gz')
        .replyWithError('Network error');

      await expect(
        rpmDatasource.getReleasesByPackageName(filelistsXmlUrl, packageName),
      ).rejects.toThrow(`Network error`);
    });

    it('throws an error if response.body is empty', async () => {
      httpMock
        .scope(filelistsXmlUrl.replace(/\/[^/]+$/, ''))
        .get('/somesha256-filelists.xml.gz')
        .reply(200, '', { 'Content-Type': 'text/xml' });

      await expect(
        rpmDatasource.getReleasesByPackageName(filelistsXmlUrl, packageName),
      ).rejects.toThrowError();
    });

    it('returns null if the specific packageName is not found in filelists.xml', async () => {
      const filelistsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<filelists xmlns="http://linux.duke.edu/metadata/filelists">
  <package pkgid="someid" name="other-package" arch="x86_64">
    <version epoch="0" ver="1.0" rel="2.azl3"/>
    <file>example-file</file>
  </package>
</filelists>
`;
      httpMock
        .scope(filelistsXmlUrl.replace(/\/[^/]+$/, ''))
        .get('/somesha256-filelists.xml.gz')
        .reply(200, filelistsXml, { 'Content-Type': 'text/xml' });
      expect(
        await rpmDatasource.getReleasesByPackageName(
          filelistsXmlUrl,
          packageName,
        ),
      ).toBeNull();
    });

    // this is most likely a bug in the RPM XML file, but we can still handle it gracefully
    it('returns an array of releases without duplicate versionWithRel', async () => {
      const filelistsXmlUrl =
        'https://example.com/repo/repodata/somesha256-filelists.xml.gz';
      const filelistsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<filelists xmlns="http://linux.duke.edu/metadata/filelists">
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.0" rel="2.dupl"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.0" rel="2.dupl"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.1" rel="1.azl3"/>
    <file>example-file</file>
  </package>
  <package pkgid="someid" name="${packageName}" arch="x86_64">
    <version epoch="0" ver="1.1" rel="2.azl3"/>
    <file>example-file</file>
  </package>
`;
      httpMock
        .scope(filelistsXmlUrl.replace(/\/[^/]+$/, ''))
        .get('/somesha256-filelists.xml.gz')
        .reply(200, filelistsXml, { 'Content-Type': 'text/xml' });
      const releases = await rpmDatasource.getReleasesByPackageName(
        filelistsXmlUrl,
        packageName,
      );
      expect(releases).toEqual({
        releases: [
          {
            version: '1.0-2.dupl',
          },
          {
            version: '1.1-1.azl3',
          },
          {
            version: '1.1-2.azl3',
          },
        ],
      });
    });
  });
  describe('getReleases', () => {
    const registryUrl = 'https://example.com/repo/repodata/';
    let rpmDatasource: RpmDatasource;
    beforeEach(() => {
      rpmDatasource = new RpmDatasource();
    });

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
      //mock the getFilelistsXmlUrl method to return the filelistsXmlUrl
      vi.spyOn(rpmDatasource, 'getFilelistsXmlUrl').mockResolvedValue(
        'https://example.com/repo/repodata/',
      );

      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockResolvedValue(
        testReleases,
      );

      const releases = await rpmDatasource.getReleases({
        registryUrl,
        packageName: 'example-package',
      });
      expect(releases).toEqual(testReleases);
      expect(rpmDatasource.getFilelistsXmlUrl).toHaveBeenCalledWith(
        registryUrl,
      );
      expect(rpmDatasource.getReleasesByPackageName).toHaveBeenCalledWith(
        'https://example.com/repo/repodata/',
        'example-package',
      );
    });

    it('throws an error if getFilelistsXmlUrl fails', async () => {
      vi.spyOn(rpmDatasource, 'getFilelistsXmlUrl').mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Network error');
    });

    it('throws an error if getReleasesByPackageName fails', async () => {
      vi.spyOn(rpmDatasource, 'getFilelistsXmlUrl').mockResolvedValue(
        'https://example.com/repo/repodata/',
      );
      vi.spyOn(rpmDatasource, 'getReleasesByPackageName').mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        rpmDatasource.getReleases({
          registryUrl,
          packageName: 'example-package',
        }),
      ).rejects.toThrow('Network error');
    });
  });
});
