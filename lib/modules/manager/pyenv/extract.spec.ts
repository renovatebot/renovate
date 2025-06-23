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
        },
      ]);
    });
  });
});
