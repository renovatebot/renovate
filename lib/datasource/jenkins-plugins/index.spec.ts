import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadJsonFixture } from '../../../test/util';
import * as versioning from '../../versioning/docker';
import { JenkinsPluginsDatasource } from '.';

const jenkinsPluginsVersions = loadJsonFixture('plugin-versions.json');
const jenkinsPluginsInfo = loadJsonFixture('update-center.actual.json');

describe('datasource/jenkins-plugins/index', () => {
  describe('getReleases', () => {
    const params = {
      versioning: versioning.id,
      datasource: JenkinsPluginsDatasource.id,
      depName: 'email-ext',
      registryUrls: ['https://updates.jenkins.io/'],
    };

    afterEach(() => {
      if (!httpMock.allUsed()) {
        throw new Error('Not all http mocks have been used!');
      }
    });

    it('returns null for a package miss', async () => {
      const newparams = { ...params };
      newparams.depName = 'non-existing';

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/update-center.actual.json')
        .reply(200, jenkinsPluginsInfo);

      expect(await getPkgReleases(newparams)).toBeNull();
    });

    it('returns package releases for a hit for info and releases', async () => {
      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/update-center.actual.json')
        .reply(200, jenkinsPluginsInfo);

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/plugin-versions.json')
        .reply(200, jenkinsPluginsVersions);

      const res = await getPkgReleases(params);
      expect(res.releases).toHaveLength(75);
      expect(res).toMatchSnapshot();

      expect(res.sourceUrl).toBe(
        'https://github.com/jenkinsci/email-ext-plugin'
      );

      expect(
        res.releases.find((release) => release.version === '2.69')
      ).toBeDefined();
      expect(
        res.releases.find((release) => release.version === '12.98')
      ).toBeUndefined();
    });

    it('returns package releases for a hit for info and miss for releases', async () => {
      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/update-center.actual.json')
        .reply(200, jenkinsPluginsInfo);

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/plugin-versions.json')
        .reply(200, '{}');

      const res = await getPkgReleases(params);
      expect(res.releases).toBeEmpty();
      expect(res).toMatchSnapshot();

      expect(res.sourceUrl).toBe(
        'https://github.com/jenkinsci/email-ext-plugin'
      );
    });

    it('returns null empty response', async () => {
      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/update-center.actual.json')
        .reply(200, '{}');

      expect(await getPkgReleases(params)).toBeNull();
    });
  });
});
