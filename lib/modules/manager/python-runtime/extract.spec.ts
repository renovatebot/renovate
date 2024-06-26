import { extractPackageFile } from '.';

describe('modules/manager/python-runtime/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('python-3.12.4\n');
      expect(res?.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python Runtime',
          currentValue: '3.12.4',
          datasource: 'docker',
        },
      ]);
    });

    it('returns no result', () => {
      const res = extractPackageFile('3.12.4\n');
      expect(res).toBeNull();
    });
  });
});
