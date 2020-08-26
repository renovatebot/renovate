import { RenovateConfig } from '../../../config/common';
import { getBranchName } from './branch-name';

describe('workers/repository/updates/branch-name', () => {
  describe('getBranchName()', () => {
    it('uses groupName if no slug defined', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      expect(getBranchName(upgrade)).toEqual('some-group-name-grouptopic');
    });
    it('uses groupSlug if defined', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group slug',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      expect(getBranchName(upgrade)).toEqual('some-group-slug-grouptopic');
    });
    it('separates major with groups', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'major',
        separateMajorMinor: true,
        newMajor: 2,
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      expect(getBranchName(upgrade)).toEqual(
        'major-2-some-group-slug-grouptopic'
      );
    });
    it('separates patch groups and uses update topic', () => {
      const upgrade: RenovateConfig = {
        branchName: 'update-branch-{{groupSlug}}-{{branchTopic}}',
        branchTopic: 'update-topic',
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'patch',
        separateMajorMinor: true,
        newMajor: 2,
        group: {},
      };
      expect(getBranchName(upgrade)).toEqual(
        'update-branch-patch-some-group-slug-update-topic'
      );
    });
    it('compiles multiple times', () => {
      const upgrade: RenovateConfig = {
        branchName: '{{branchTopic}}',
        branchTopic: '{{depName}}',
        depName: 'dep',
        group: {},
      };
      expect(getBranchName(upgrade)).toEqual('dep');
    });
    it('enforces valid git branch name', async () => {
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
      fixtures.forEach((update) => {
        expect(getBranchName(update.upgrade)).toEqual(
          update.expectedBranchName
        );
      });
    });
  });
});
