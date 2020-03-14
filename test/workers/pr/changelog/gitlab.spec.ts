import { api } from '../../../../lib/platform/gitlab/gl-got-wrapper';
import * as hostRules from '../../../../lib/util/host-rules';
import {
  getChangeLogJSON,
  ChangeLogConfig,
  ChangeLogError,
} from '../../../../lib/workers/pr/changelog';
import { mocked } from '../../../util';
import { PLATFORM_TYPE_GITHUB } from '../../../../lib/constants/platforms';
import * as semverVersioning from '../../../../lib/versioning/semver';

jest.mock('../../../../lib/platform/gitlab/gl-got-wrapper');
jest.mock('../../../../lib/datasource/npm');

const glGot = mocked(api).get;

const upgrade: ChangeLogConfig = {
  endpoint: 'https://gitlab.com/api/v4/ ',
  depName: 'renovate',
  versioning: semverVersioning.id,
  fromVersion: '5.2.0',
  toVersion: '5.7.0',
  sourceUrl: 'https://gitlab.com/meno/dropzone/',
  releases: [
    // TODO: test gitRef
    { version: '5.2.0' },
    {
      version: '5.4.0',
      releaseTimestamp: '2018-08-24T14:23:00.000Z',
    },
    { version: '5.5.0' },
    { version: '5.6.0', releaseTimestamp: '2020-02-13T15:37:00.000Z' },
    { version: '5.6.1' },
  ],
};

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(async () => {
      glGot.mockClear();
      hostRules.clear();
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        baseUrl: 'https://gitlab.com/api/v4/',
        token: 'abc',
      });
      await global.renovateCache.rmAll();
    });
    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: null,
        })
      ).toBeNull();
      expect(glGot).toHaveBeenCalledTimes(0);
    });
    it('returns null if no fromVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab.com/meno/dropzone',
        })
      ).toBeNull();
      expect(glGot).toHaveBeenCalledTimes(0);
    });
    it('returns null if fromVersion equals toVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: '1.0.0',
          toVersion: '1.0.0',
        })
      ).toBeNull();
      expect(glGot).toHaveBeenCalledTimes(0);
    });
    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab.com/nonononononononononononono',
        })
      ).toBeNull();
    });
    it('works without GitLub', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
    });
    it('uses GitLab tags', async () => {
      glGot.mockResolvedValueOnce({
        body: [
          { name: 'v5.2.0' },
          { name: 'v5.4.0' },
          { name: 'v5.5.0' },
          { name: 'v5.6.0' },
          { name: 'v5.6.1' },
          { name: 'v5.7.0' },
        ],
      } as never);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
    });
    it('filters unnecessary warns', async () => {
      glGot.mockImplementation(() => {
        throw new Error('Unknown GitLab Repo');
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot();
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
    it('handles missing GitLab token', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab.com',
        })
      ).toEqual({ error: ChangeLogError.MissingGitlabToken });
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
    it('supports gitlab enterprise and gitlab.com changelog', async () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        token: 'super_secret',
        baseUrl: 'https://gitlab-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          endpoint: 'https://gitlab-enterprise.example.com/',
        })
      ).toMatchSnapshot();
    });
    it('supports gitlab enterprise and gitlab enterprise changelog', async () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_GITHUB,
        baseUrl: 'https://gitlab-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://gitlab-enterprise.example.com/meno/dropzone/',
          endpoint: 'https://gitlab-enterprise.example.com/',
        })
      ).toMatchSnapshot();
    });
  });
});
