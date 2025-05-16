import { RpmDatasource } from '.';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/rpm/index', () => {
  describe('getFilelistsXmlUrl', () => {
    const registryUrl = 'https://example.com/repo/repodata/';

    it('returns the correct filelists.xml URL', async () => {
      const repomdXml = `<?xml version="1.0" encoding="UTF-8"?>
<repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
  <data type="filelists">
    <location href="repodata/somesha256-filelists.xml.gz"/>
  </data>
</repomd>`;

      httpMock
        .scope(registryUrl)
        .get('/repomd.xml')
        .reply(200, repomdXml, { 'Content-Type': 'text/xml' });

      const rpmDatasource = new RpmDatasource();
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

      const rpmDatasource = new RpmDatasource();

      await expect(
        rpmDatasource.getFilelistsXmlUrl(registryUrl),
      ).rejects.toThrow(`Network error`);
    });

    it('throws an error if no filelists data is found', async () => {
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

      const rpmDatasource = new RpmDatasource();

      await expect(
        rpmDatasource.getFilelistsXmlUrl(registryUrl),
      ).rejects.toThrow(`No filelists found in repomd.xml`);
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

      const rpmDatasource = new RpmDatasource();

      await expect(
        rpmDatasource.getFilelistsXmlUrl(registryUrl),
      ).rejects.toThrow(`No href found in filelists.xml`);
    });
  });
});
