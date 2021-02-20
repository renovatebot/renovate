import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as versioning from '../../versioning/docker';
import jenkinsPluginsVersions from './__fixtures__/plugin-versions.json';
import jenkinsPluginsInfo from './__fixtures__/update-center.actual.json';
import { resetCache } from './get';
import * as jenkins from '.';

describe(getName(__filename), () => {
  describe('getReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      versioning: versioning.id,
      datasource: jenkins.id,
      depName: 'email-ext',
      registryUrls: ['https://updates.jenkins.io/'],
    };

    beforeEach(() => {
      resetCache();
      httpMock.setup();
      process.env.RENOVATE_SKIP_CACHE = 'true';
      jest.resetAllMocks();
    });

    afterEach(() => {
      if (!httpMock.allUsed()) {
        throw new Error('Not all http mocks have been used!');
      }
      httpMock.reset();
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });

    it('returns null for a package miss', async () => {
      const newparams = { ...params };
      newparams.depName = 'non-existing';

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/update-center.actual.json')
        .reply(200, jenkinsPluginsInfo);

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/plugin-versions.json')
        .reply(200, jenkinsPluginsVersions);

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

      let res = await getPkgReleases(params);
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

      // check that caching is working and no http requests are done after the first call to getPkgReleases
      res = await getPkgReleases(params);
      expect(res.releases).toHaveLength(75);
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

      httpMock
        .scope('https://updates.jenkins.io')
        .get('/current/plugin-versions.json')
        .reply(200, '{}');

      expect(await getPkgReleases(params)).toBeNull();
    });
  });
});
