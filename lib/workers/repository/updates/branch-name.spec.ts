import type { RenovateConfig } from '../../../config/types';
import { generateBranchName } from './branch-name';

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
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('some-group-name-grouptopic');
    });

    it('compile groupName before slugging', () => {
      const upgrade: RenovateConfig = {
        groupName: '{{parentDir}}',
        parentDir: 'myService',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('myservice-grouptopic');
    });

    it('uses groupSlug if defined', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group {{parentDir}}',
        parentDir: 'abc',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('some-group-abc-grouptopic');
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
      expect(upgrade.branchName).toBe('major-2-some-group-slug-grouptopic');
    });

    it('separates minor with groups', () => {
      const upgrade: RenovateConfig = {
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'minor',
        separateMultipleMinor: true,
        newMinor: 1,
        newMajor: 2,
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('minor-2.1-some-group-slug-grouptopic');
    });

    it('separates minor when separateMultipleMinor=true', () => {
      const upgrade: RenovateConfig = {
        branchName:
          '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
        branchPrefix: 'renovate/',
        additionalBranchPrefix: '',
        depNameSanitized: 'lodash',
        newMajor: 4,
        separateMinorPatch: true,
        isPatch: true,
        newMinor: 17,
        branchTopic:
          '{{{depNameSanitized}}}-{{{newMajor}}}{{#if separateMinorPatch}}{{#if isPatch}}.{{{newMinor}}}{{/if}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        depName: 'dep',
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('renovate/lodash-4.17.x');
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
      expect(upgrade.branchName).toBe('major-some-group-slug-grouptopic');
    });

    it('separates patch groups and uses update topic', () => {
      const upgrade: RenovateConfig = {
        branchName: 'update-branch-{{groupSlug}}-{{branchTopic}}',
        branchTopic: 'update-topic',
        groupName: 'some group name',
        groupSlug: 'some group slug',
        updateType: 'patch',
        separateMajorMinor: true,
        separateMinorPatch: true,
        newMajor: 2,
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe(
        'update-branch-patch-some-group-slug-update-topic',
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
      expect(upgrade.branchName).toBe('dep');
    });

    it('separates patches when separateMinorPatch=true', () => {
      const upgrade: RenovateConfig = {
        branchName:
          '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
        branchPrefix: 'renovate/',
        additionalBranchPrefix: '',
        depNameSanitized: 'lodash',
        newMajor: 4,
        separateMinorPatch: true,
        isPatch: true,
        newMinor: 17,
        branchTopic:
          '{{{depNameSanitized}}}-{{{newMajor}}}{{#if separateMinorPatch}}{{#if isPatch}}.{{{newMinor}}}{{/if}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        depName: 'dep',
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('renovate/lodash-4.17.x');
    });

    it('does not separate patches when separateMinorPatch=false', () => {
      const upgrade: RenovateConfig = {
        branchName:
          '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
        branchPrefix: 'renovate/',
        additionalBranchPrefix: '',
        depNameSanitized: 'lodash',
        newMajor: 4,
        separateMinorPatch: false,
        isPatch: true,
        newMinor: 17,
        branchTopic:
          '{{{depNameSanitized}}}-{{{newMajor}}}{{#if separateMinorPatch}}{{#if isPatch}}.{{{newMinor}}}{{/if}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        depName: 'dep',
        group: {},
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('renovate/lodash-4.x');
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
      expect(upgrade.branchName).toBe('renovate/jest-42.x');
    });

    it('realistic defaults with strict branch name enabled', () => {
      const upgrade: RenovateConfig = {
        branchNameStrict: true,
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
      expect(upgrade.branchName).toBe('renovate/jest-42-x');
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
      expect(upgrade.branchName).toBe('dep-df9ca0f348');
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
      expect(upgrade.branchName).toBe('dep-df9ca0f34833f3e0');
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
      expect(upgrade.branchName).toBe('dep-df9ca0');
    });

    it('hashedBranchLength no topic', () => {
      const upgrade: RenovateConfig = {
        hashedBranchLength: 3,
        branchPrefix: 'dep-',
        depNameSanitized: 'jest',
        newMajor: '42',
        groupName: 'some group name',
        group: {
          branchName:
            '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
          additionalBranchPrefix:
            '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe('dep-cf83e1');
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
          expectedBranchName: 'renovate/bad-branch-name2',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-^-name3' },
          expectedBranchName: 'renovate/bad-branch-name3',
        },
        {
          upgrade: { branchName: 'renovate/bad-branch-name : 4' },
          expectedBranchName: 'renovate/bad-branch-name-4',
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
        {
          upgrade: { branchName: 'renovate/bad-branch--name10' },
          expectedBranchName: 'renovate/bad-branch-name10',
        },
        {
          upgrade: { branchName: 'renovate/bad--branch---name11' },
          expectedBranchName: 'renovate/bad-branch-name11',
        },
        {
          upgrade: { branchName: 'renovate-/[start]-something-[end]' },
          expectedBranchName: 'renovate/start-something-end',
        },
      ];
      fixtures.forEach((fixture) => {
        generateBranchName(fixture.upgrade);
        expect(fixture.upgrade.branchName).toEqual(fixture.expectedBranchName);
      });
    });

    it('strict branch name enabled group', () => {
      const upgrade: RenovateConfig = {
        branchNameStrict: true,
        groupName: 'some group name `~#$%^&*()-_=+[]{}|;,./<>? .version',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe(
        'some-group-name-dollarpercentand-or-lessgreater-version-grouptopic',
      );
    });

    it('strict branch name disabled', () => {
      const upgrade: RenovateConfig = {
        branchNameStrict: false,
        groupName: '[some] group name.#$%version',
        group: {
          branchName: '{{groupSlug}}-{{branchTopic}}',
          branchTopic: 'grouptopic',
        },
      };
      generateBranchName(upgrade);
      expect(upgrade.branchName).toBe(
        'some-group-name.dollarpercentversion-grouptopic',
      );
    });
  });
});
