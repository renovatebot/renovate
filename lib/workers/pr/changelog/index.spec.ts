import * as httpMock from '../../../../test/httpMock';
import { partial } from '../../../../test/util';
import { PLATFORM_TYPE_GITHUB } from '../../../constants/platforms';
import * as globalCache from '../../../util/cache/global';
import { clear } from '../../../util/cache/run';
import * as runCache from '../../../util/cache/run';
import * as hostRules from '../../../util/host-rules';
import * as semverVersioning from '../../../versioning/semver';
import { BranchConfig } from '../../common';
import { ChangeLogError, getChangeLogJSON } from '.';

jest.mock('../../../datasource/npm');

const githubApiHost = 'https://api.github.com';

const upgrade: BranchConfig = partial<BranchConfig>({
  endpoint: 'https://api.github.com/',
  depName: 'renovate',
  versioning: semverVersioning.id,
  fromVersion: '1.0.0',
  toVersion: '3.0.0',
  sourceUrl: 'https://github.com/chalk/chalk',
  releases: [
    { version: '0.9.0' },
    { version: '1.0.0', gitRef: 'npm_1.0.0' },
    {
      version: '2.3.0',
      gitRef: 'npm_2.3.0',
      releaseTimestamp: '2017-10-24T03:20:46.238Z',
    },
    { version: '2.2.2', gitRef: 'npm_2.2.2' },
    { version: '2.4.2', releaseTimestamp: '2017-12-24T03:20:46.238Z' },
    { version: '2.5.2' },
  ],
});

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(async () => {
      httpMock.setup();
      hostRules.clear();
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        baseUrl: 'https://api.github.com/',
        token: 'abc',
      });
      await globalCache.rmAll();
      runCache.clear();
    });

    afterEach(() => {
      clear();
      httpMock.reset();
    });

    it('returns null if @types', async () => {
      httpMock.scope(githubApiHost);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: null,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toHaveLength(0);
    });
    it('returns null if no fromVersion', async () => {
      httpMock.scope(githubApiHost);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toHaveLength(0);
    });
    it('returns null if fromVersion equals toVersion', async () => {
      httpMock.scope(githubApiHost);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: '1.0.0',
          toVersion: '1.0.0',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toHaveLength(0);
    });
    it('skips invalid repos', async () => {
      httpMock.scope(githubApiHost);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/about',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toHaveLength(0);
    });
    it('works without Github', async () => {
      httpMock.scope(githubApiHost);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toHaveLength(0);
    });
    it('uses GitHub tags', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/chalk/chalk/tags?per_page=100')
        .reply(200, [
          { name: '0.9.0' },
          { name: '1.0.0' },
          { name: '1.4.0' },
          { name: 'v2.3.0' },
          { name: '2.2.2' },
          { name: 'v2.4.2' },
        ])
        .persist()
        .get(/.*/)
        .reply(200, []);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('filters unnecessary warns', async () => {
      httpMock
        .scope(githubApiHost)
        .persist()
        .get(/.*/)
        .replyWithError('Unknown Github Repo');
      const res = await getChangeLogJSON({
        ...upgrade,
        depName: '@renovate/no',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports node engines', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        })
      ).toMatchSnapshot();
    });
    it('handles no sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: undefined,
        })
      ).toBeNull();
    });
    it('handles invalid sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        })
      ).toBeNull();
    });
    it('handles missing Github token', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        })
      ).toEqual({ error: ChangeLogError.MissingGithubToken });
    });
    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        })
      ).toBeNull();
    });
    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        })
      ).toBeNull();
    });
    it('supports github enterprise and github.com changelog', async () => {
      httpMock.scope(githubApiHost).persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        token: 'super_secret',
        baseUrl: 'https://github-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports github enterprise and github enterprise changelog', async () => {
      httpMock
        .scope('https://github-enterprise.example.com')
        .persist()
        .get(/.*/)
        .reply(200, []);
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        baseUrl: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('supports github.com and github enterprise changelog', async () => {
      httpMock
        .scope('https://github-enterprise.example.com')
        .persist()
        .get(/.*/)
        .reply(200, []);
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        baseUrl: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
