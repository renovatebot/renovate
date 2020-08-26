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
    it('compiles multiple times and cleans', () => {
      const upgrade: RenovateConfig = {
        branchName: '{{branchTopic}}',
        branchTopic: '{{depName}}',
        depName: '.dep',
        group: {},
      };
      expect(getBranchName(upgrade)).toEqual('dep');
    });
  });
});
