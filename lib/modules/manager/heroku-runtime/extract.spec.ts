import { extractPackageFile } from '.';

describe('modules/manager/heroku-runtime/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('python-3.12.4\n');
      expect(res?.deps).toEqual([
        {
          depName: 'python',
          commitMessageTopic: 'Heroku Runtime - Python',
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
