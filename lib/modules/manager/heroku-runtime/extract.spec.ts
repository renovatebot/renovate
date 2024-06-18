import { extractPackageFile } from '.';

describe('modules/manager/heroku-python/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('python-3.12.4\n');
      expect(res.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Python',
          currentValue: '3.12.4',
          datasource: 'docker',
        },
      ]);
    });
  });
});
