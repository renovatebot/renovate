import { RenovateConfig, mocked } from '../../../util';
import { branchifyUpgrades } from '../../../../lib/workers/repository/updates/branchify';
import * as _flatten from '../../../../lib/workers/repository/updates/flatten';
import { BranchConfig } from '../../../../lib/workers/common';
import { getConfig } from '../../../../lib/config/defaults';

const flattenUpdates = mocked(_flatten).flattenUpdates;
jest.mock('../../../../lib/workers/repository/updates/flatten');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/branchify', () => {
  describe('branchifyUpgrades()', () => {
    it('returns empty', () => {
      flattenUpdates.mockReturnValueOnce([]);
      const res = branchifyUpgrades(config, {});
      expect(res.branches).toEqual([]);
    });
    it('returns one branch if one input', () => {
      flattenUpdates.mockReturnValueOnce([
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
          updateType: 'minor',
        },
      ]);
      config.repoIsOnboarded = true;
      const res = branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
      expect(res.branches[0].isMinor).toBe(true);
      expect(res.branches[0].upgrades[0].isMinor).toBe(true);
    });
    it('uses major/minor/patch slugs', () => {
      flattenUpdates.mockReturnValueOnce([
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '2.0.0',
          prTitle: 'some-title',
          updateType: 'major',
          groupName: 'some packages',
          group: {},
          separateMajorMinor: true,
        },
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
          updateType: 'minor',
          groupName: 'some packages',
          group: {},
          separateMajorMinor: true,
          separateMinorPatch: true,
        },
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.0.1',
          prTitle: 'some-title',
          updateType: 'patch',
          groupName: 'some packages',
          group: {},
          separateMajorMinor: true,
          separateMinorPatch: true,
        },
        {
          depName: 'bar',
          branchName: 'bar-{{version}}',
          version: '2.0.0',
          prTitle: 'some-title',
          updateType: 'major',
          groupName: 'other packages',
          group: {},
          separateMultipleMajor: true,
          separateMajorMinor: true,
          newMajor: 2,
        },
      ]);
      config.repoIsOnboarded = true;
      const res = branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(4);
      expect(res.branches[0].isMajor).toBe(true);
      expect(res.branches[0].groupSlug).toBe(`major-some-packages`);
      expect(res.branches[1].isMinor).toBe(true);
      expect(res.branches[1].groupSlug).toBe(`some-packages`);
      expect(res.branches[2].isPatch).toBe(true);
      expect(res.branches[2].groupSlug).toBe(`patch-some-packages`);
      expect(res.branches[3].isMajor).toBe(true);
      expect(res.branches[3].groupSlug).toBe(`major-2-other-packages`);
    });
    it('does not group if different compiled branch names', () => {
      flattenUpdates.mockReturnValueOnce([
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
          version: '1.1.0',
          prTitle: 'some-title',
        },
        {
          depName: 'foo',
          branchName: 'foo-{{version}}',
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
      const res = branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(3);
    });
    it('groups if same compiled branch names', () => {
      flattenUpdates.mockReturnValueOnce([
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
      const res = branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });
    it('groups if same compiled group name', () => {
      flattenUpdates.mockReturnValueOnce([
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
      const res = branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });
    it('enforces valid git branch name', () => {
      const fixtures = [
        {
          upgrade: {
            groupName: '/My Group/',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/my-group',
        },
        {
          upgrade: {
            groupName: 'invalid branch name.lock',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/invalid-branch-name',
        },
        {
          upgrade: {
            groupName: '.a-bad-  name:@.lock',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          expectedBranchName: 'renovate/a-bad-name-@',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name1..' },
          expectedBranchName: 'renovate/bad-branch-name1',
        },
        {
          upgrade: { branchName: 'renovate/~bad-branch-name2' },
          expectedBranchName: 'renovate/-bad-branch-name2',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-^-name3' },
          expectedBranchName: 'renovate/bad-branch---name3',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name : 4' },
          expectedBranchName: 'renovate/bad-branch-name---4',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name5/' },
          expectedBranchName: 'renovate/bad-branch-name5',
        },
        {
          upgrade: { branchName: '.bad-branch-name6' },
          expectedBranchName: 'bad-branch-name6',
        },
        {
          upgrade: { branchName: 'renovate/.bad-branch-name7' },
          expectedBranchName: 'renovate/bad-branch-name7',
        },
        {
          upgrade: { branchName: 'renovate/.bad-branch-name8' },
          expectedBranchName: 'renovate/bad-branch-name8',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name9.' },
          expectedBranchName: 'renovate/bad-branch-name9',
        },
      ];
      flattenUpdates.mockReturnValueOnce(
        fixtures.map(({ upgrade }) => upgrade)
      );

      branchifyUpgrades(config, {}).branches.forEach(
        ({ branchName }: BranchConfig, index: number) => {
          expect(branchName).toBe(fixtures[index].expectedBranchName);
        }
      );
    });
  });
});
