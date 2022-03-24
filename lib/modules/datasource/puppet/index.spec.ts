import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { loadFixture } from '../../../../test/util';
import { PuppetDatasource } from './index';

const puppetforgeReleases = loadFixture('puppetforge-response.json');

const datasource = PuppetDatasource.id;

describe('modules/datasource/puppet/index', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://forgeapi.puppet.com')
        .get('/v3/modules/puppetlabs-apache')
        .reply(200, puppetforgeReleases);

      const res = await getPkgReleases({
        datasource,
        depName: 'puppetlabs/apache',
        packageName: 'puppetlabs/apache',
        registryUrls: ['https://forgeapi.puppet.com'],
      });
      const release = res.releases[res.releases.length - 1];

      expect(res.releases).toHaveLength(4);
      expect(release.version).toEqual('7.0.0');
      expect(release.downloadUrl).toEqual(
        '/v3/files/puppetlabs-apache-7.0.0.tar.gz'
      );
      expect(release.releaseTimestamp).toEqual('2021-10-11T14:47:24.000Z');
      expect(release.registryUrl).toEqual('https://forgeapi.puppet.com');
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
