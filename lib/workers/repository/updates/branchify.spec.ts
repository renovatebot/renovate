import { RenovateConfig, mocked, mockedFunction } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import * as _changelog from '../changelog';
import { branchifyUpgrades } from './branchify';
import * as _flatten from './flatten';

const flattenUpdates = mocked(_flatten).flattenUpdates;
const embedChangelogs = mocked(_changelog).embedChangelogs;

jest.mock('./flatten');
jest.mock('../changelog');

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/branchify', () => {
  describe('branchifyUpgrades()', () => {
    it('returns empty', async () => {
      flattenUpdates.mockResolvedValueOnce([]);
      const res = await branchifyUpgrades(config, {});
      expect(res.branches).toBeEmptyArray();
    });

    it('returns one branch if one input', async () => {
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
          updateType: 'minor',
          packageFile: 'foo/package.json',
        },
      ]);
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('deduplicates', async () => {
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          currentValue: '1.1.0',
          newValue: '1.3.0',
          prTitle: 'some-title',
          updateType: 'minor',
          packageFile: 'foo/package.json',
        },
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          currentValue: '1.1.0',
          newValue: '1.2.0',
          prTitle: 'some-title',
          updateType: 'minor',
          packageFile: 'foo/package.json',
        },
      ]);
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('groups if same compiled branch names', async () => {
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo',
          version: '1.1.0',
          prTitle: 'some-title',
        },
        {
          depName: 'foo',
          branchName: 'foo',
          version: '2.0.0',
          prTitle: 'some-title',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
      ]);
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('groups if same compiled group name', async () => {
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/{{groupSlug}}' },
        },
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '2.0.0',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
      ]);
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('no fetch changelogs', async () => {
      config.fetchReleaseNotes = false;
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/{{groupSlug}}' },
        },
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '2.0.0',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
      ]);
      const res = await branchifyUpgrades(config, {});
      expect(embedChangelogs).not.toHaveBeenCalled();
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('fetch changelogs if required', async () => {
      config.fetchReleaseNotes = true;
      config.repoIsOnboarded = true;
      mockedFunction(_changelog.needsChangelogs).mockReturnValueOnce(true);
      flattenUpdates.mockResolvedValueOnce([
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/{{groupSlug}}' },
        },
        {
          depName: 'foo',
          branchName: 'foo',
          prTitle: 'some-title',
          version: '2.0.0',
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          prTitle: 'some-title',
          version: '1.1.0',
          groupName: 'My Group',
          group: { branchName: 'renovate/my-group' },
        },
      ]);
      const res = await branchifyUpgrades(config, {});
      expect(embedChangelogs).toHaveBeenCalledOnce();
      expect(Object.keys(res.branches)).toHaveLength(2);
    });
  });
});
