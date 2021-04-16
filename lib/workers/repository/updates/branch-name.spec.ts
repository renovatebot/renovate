import { getName } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
import { generateBranchName } from './branch-name';

describe(getName(__filename), () => {
  describe('getBranchName()', () => {
    it('uses groupName if no slug defined', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('some-group-name-grouptopic');
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
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('some-group-slug-grouptopic');
    });
    it('separates major with groups', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'major',
        separateMajorMinor: true,
        separateMultipleMajor: true,
        newMajor: 2,
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('major-2-some-group-slug-grouptopic');
    });
    it('uses single major with groups', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'major',
        separateMajorMinor: true,
        separateMultipleMajor: false,
        newMajor: 2,
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('major-some-group-slug-grouptopic');
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
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual(
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
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('dep');
    });

    it('realistic defaults', () => {
      const upgrade: RenovateConfig = {
        branchName:
          '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
        branchTopic:
          '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        branchPrefix: 'renovate/',
        depNameSanitized: 'jest',
        newMajor: '42',
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('renovate/jest-42.x');
    });

    it('hashedBranchLength hashing', () => {
      const upgrade: RenovateConfig = {
        branchName:
          '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
        branchTopic:
          '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        hashedBranchLength: 14,
        branchPrefix: 'dep-',
        depNameSanitized: 'jest',
        newMajor: '42',
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('dep-df9ca0f348');
    });

    it('hashedBranchLength hashing with group name', () => {
      const upgrade: RenovateConfig = {
        hashedBranchLength: 20,
        branchPrefix: 'dep-',
        depNameSanitized: 'jest',
        newMajor: '42',
        groupName: 'some group name',
        group: {
          branchName:
            '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
          branchTopic:
            '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('dep-df9ca0f34833f3e0');
    });

    it('hashedBranchLength too short', () => {
      const upgrade: RenovateConfig = {
        hashedBranchLength: 3,
        branchPrefix: 'dep-',
        depNameSanitized: 'jest',
        newMajor: '42',
        groupName: 'some group name',
        group: {
          branchName:
            '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
          branchTopic:
            '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toEqual('dep-df9ca0');
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
      fixtures.forEach((fixture) => {
        generateBranchName(fixture.upgrade);
        expect(fixture.upgrade.branchName).toEqual(fixture.expectedBranchName);
      });
    });
  });
});
