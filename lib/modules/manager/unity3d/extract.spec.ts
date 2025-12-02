import { extractPackageFile } from '.';

describe('modules/manager/unity3d/extract', () => {
  describe('extractPackageFile()', () => {
    it.each([
      'm_EditorVersion: ',
      'm_EditorVersionWithRevision: ',
      'invalidKey: a',
    ])('handles no version', (content) => {
      const res = extractPackageFile(content);
      expect(res).toBeNull();
    });

    it.each([
      {
        content: 'm_EditorVersion: 2022.3.19f1',
        value: '2022.3.19f1',
        depName: 'Unity Editor',
        packageName: 'm_EditorVersion',
      },
      {
        content: 'm_EditorVersionWithRevision: 2022.3.19f1 (30acc77e9b6b)',
        value: '2022.3.19f1 (30acc77e9b6b)',
        depName: 'Unity Editor',
        packageName: 'm_EditorVersionWithRevision',
      },
    ])('handles $packageName', ({ content, value, depName, packageName }) => {
      const res = extractPackageFile(content)?.deps;
      expect(res).toEqual([
        {
          currentValue: value,
          datasource: 'unity3d',
          depName,
          packageName,
        },
      ]);
    });

    it.each([
      {
        type: 'alpha',
        content:
          'm_EditorVersion: 2022.3.0a1\nm_EditorVersionWithRevision: 2022.3.0a1 (244b723c30a6)',
        version: '2022.3.0a1',
        versionWithRevision: '2022.3.0a1 (244b723c30a6)',
      },
      {
        type: 'beta',
        content:
          'm_EditorVersion: 2023.3.0b5\nm_EditorVersionWithRevision: 2023.3.0b5 (30acc77e9b6b)',
        version: '2023.3.0b5',
        versionWithRevision: '2023.3.0b5 (30acc77e9b6b)',
      },
      {
        type: 'stable',
        content:
          'm_EditorVersion: 2021.3.35f1\nm_EditorVersionWithRevision: 2021.3.35f1 (122a674b12f3)',
        version: '2021.3.35f1',
        versionWithRevision: '2021.3.35f1 (122a674b12f3)',
      },
    ])(
      'handles $type versions',
      ({ content, version, versionWithRevision }) => {
        const res = extractPackageFile(content)?.deps;
        expect(res).toEqual([
          {
            currentValue: version,
            datasource: 'unity3d',
            depName: 'Unity Editor',
            packageName: 'm_EditorVersion',
          },
          {
            currentValue: versionWithRevision,
            datasource: 'unity3d',
            depName: 'Unity Editor',
            packageName: 'm_EditorVersionWithRevision',
          },
        ]);
      },
    );
  });
});
