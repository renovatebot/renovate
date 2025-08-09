import { extractPackageFile } from '.';

describe('modules/manager/pyenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('3.7.1\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.7.1',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'patch',
        },
      ]);
    });

    it('supports ranges', () => {
      const res = extractPackageFile('3.8\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: 'latestn',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: undefined,
        },
      ]);
    });

    it('ignores hashes', () => {
      const res = extractPackageFile('# version 3.8\n3.8');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 10,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('ignores hashes in line', () => {
      const res = extractPackageFile('3.8 # Latest version');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('supports multiple lines and versions', () => {
      const res = extractPackageFile('3.8\n3.9\n3.10\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'minor',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.9',
          datasource: 'docker',
          fileReplacePosition: 4,
          bumpVersion: 'minor',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.10',
          datasource: 'docker',
          fileReplacePosition: 8,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('supports multiple lines and versions, but ignores versions in comments', () => {
      const res = extractPackageFile('3.8\n # 3.9\n3.10\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'minor',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.10',
          datasource: 'docker',
          fileReplacePosition: 11,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('supports multiple lines and versions, but ignores blanks', () => {
      const res = extractPackageFile('3.8\n  \n3.9\n\n3.10\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8',
          datasource: 'docker',
          fileReplacePosition: 0,
          bumpVersion: 'minor',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.9',
          datasource: 'docker',
          fileReplacePosition: 7,
          bumpVersion: 'minor',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.10',
          datasource: 'docker',
          fileReplacePosition: 12,
          bumpVersion: 'minor',
        },
      ]);
    });

    it('supports a full-blown spec', () => {
      const res = extractPackageFile(
        '# A python version\n3.8.1\n  \n3.9.3 # intermediate version\n\n3.10.4\n',
      );
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.8.1',
          datasource: 'docker',
          fileReplacePosition: 19,
          bumpVersion: 'patch',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.9.3',
          datasource: 'docker',
          fileReplacePosition: 28,
          bumpVersion: 'patch',
        },
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.10.4',
          datasource: 'docker',
          fileReplacePosition: 58,
          bumpVersion: 'patch',
        },
      ]);
    });
  });
});
