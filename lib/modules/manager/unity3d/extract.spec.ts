import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const beta = Fixtures.get('beta.ProjectVersion.txt');
const lts = Fixtures.get('lts.ProjectVersion.txt');
const stable = Fixtures.get('stable.ProjectVersion.txt');

describe('modules/manager/unity3d/extract', () => {
  describe('extractPackageFile()', () => {
    it('handles no version', () => {
      const res = extractPackageFile(
        'm_EditorVersion: ',
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toBeEmpty();
    });

    it('skips ProjectVersion.txt outside of ProjectSettings directory', () => {
      const res = extractPackageFile(
        'm_EditorVersion: 2022.3.19f1\n',
        'ProjectVersion.txt',
      )?.deps;
      expect(res).toBeEmpty();
    });

    it('skips ProjectVersion.txt inside directories ending in `ProjectSettings`', () => {
      const res = extractPackageFile(
        'm_EditorVersion: 2022.3.19f1\n',
        'OtherProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toBeEmpty();
    });

    it('handles m_EditorVersion', () => {
      const res = extractPackageFile(
        'm_EditorVersion: 2022.3.19f1\n',
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2022.3.19f1',
          datasource: 'unity3d',
          depName: 'm_EditorVersion',
          depType: 'final',
          replaceString: 'm_EditorVersion: 2022.3.19f1',
        },
      ]);
    });

    it('handles beta versions', () => {
      const res = extractPackageFile(
        beta,
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2023.3.0b5',
          datasource: 'unity3d',
          depName: 'm_EditorVersion',
          depType: 'final',
          replaceString: 'm_EditorVersion: 2023.3.0b5',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2023.3.0b5 (30acc77e9b6b)',
          datasource: 'unity3d',
          depName: 'm_EditorVersionWithRevision',
          depType: 'final',
          replaceString:
            'm_EditorVersionWithRevision: 2023.3.0b5 (30acc77e9b6b)',
        },
      ]);
    });

    it('handles stable versions', () => {
      const res = extractPackageFile(
        stable,
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2022.3.19f1',
          datasource: 'unity3d',
          depName: 'm_EditorVersion',
          depType: 'final',
          replaceString: 'm_EditorVersion: 2022.3.19f1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2022.3.19f1 (244b723c30a6)',
          datasource: 'unity3d',
          depName: 'm_EditorVersionWithRevision',
          depType: 'final',
          replaceString:
            'm_EditorVersionWithRevision: 2022.3.19f1 (244b723c30a6)',
        },
      ]);
    });

    it('handles lts versions', () => {
      const res = extractPackageFile(
        lts,
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2021.3.35f1',
          datasource: 'unity3d',
          depName: 'm_EditorVersion',
          depType: 'final',
          replaceString: 'm_EditorVersion: 2021.3.35f1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2021.3.35f1 (157b46ce122a)',
          datasource: 'unity3d',
          depName: 'm_EditorVersionWithRevision',
          depType: 'final',
          replaceString:
            'm_EditorVersionWithRevision: 2021.3.35f1 (157b46ce122a)',
        },
      ]);
    });

    it('skips if casing is incorrect', () => {
      const res = extractPackageFile(
        'm_EditorVersionWITHRevision: 2022.3.19f1 (244b723c30a6)\n',
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toBeEmpty();
    });

    it('skips abnormal spacing', () => {
      const res = extractPackageFile(
        'm_EditorVersionWithRevision:  2022.3.19f1 (244b723c30a6)\n',
        'ProjectSettings/ProjectVersion.txt',
      )?.deps;
      expect(res).toBeEmpty();
    });
  });
});
