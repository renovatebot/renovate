import * as httpMock from '../../../../test/http-mock';
import { PlatformId } from '../../../constants';
import * as hostRules from '../../../util/host-rules';
import * as semverVersioning from '../../../versioning/semver';
import type { BranchUpgradeConfig } from '../../types';
import { ChangeLogError, getChangeLogJSON } from '.';

jest.mock('../../../../lib/datasource/npm');

const upgrade: BranchUpgradeConfig = {
  branchName: undefined,
  depName: 'renovate',
  endpoint: 'https://api.github.com/',
  versioning: semverVersioning.id,
  currentVersion: '1.0.0',
  newVersion: '3.0.0',
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
};

describe('workers/pr/changelog/github', () => {
  afterEach(() => {
    // FIXME: add missing http mocks
    httpMock.clear(false);
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: PlatformId.Github,
        matchHost: 'https://api.github.com/',
        token: 'abc',
      });
    });

    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: null,
        })
      ).toBeNull();
    });

    it('returns null if no currentVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
        })
      ).toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        })
      ).toBeNull();
    });

    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/about',
        })
      ).toBeNull();
    });

    it('works without Github', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('uses GitHub tags', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('filters unnecessary warns', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: '@renovate/no',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('supports node engines', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
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
      hostRules.add({
        hostType: PlatformId.Github,
        token: 'super_secret',
        matchHost: 'https://github-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('supports github enterprise and github enterprise changelog', async () => {
      hostRules.add({
        hostType: PlatformId.Github,
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          baseUrl: 'https://github-enterprise.example.com/',
          depName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });
  });
});
