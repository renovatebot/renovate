const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/composer/extract');

const requirements1 = fs.readFileSync(
  'test/_fixtures/composer/composer1.json',
  'utf8'
);

describe('lib/manager/pip_requirements/extract', () => {
  describe('extractDependencies()', () => {
    let packageFile;
    beforeEach(() => {
      packageFile = {
        packageFile: 'composer.json',
      };
    });
    it('returns null for invalid json', async () => {
      expect(await extractDependencies('nothing here', packageFile)).toBe(null);
    });
    it('returns null for empty deps', async () => {
      expect(await extractDependencies('{}', packageFile)).toBe(null);
    });
    it('extracts dependencies with no lock file', async () => {
      const res = await extractDependencies(requirements1, packageFile);
      expect(res).toMatchSnapshot();
    });
    it('extracts dependencies with lock file', async () => {
      platform.getFile.mockReturnValueOnce('some content');
      const res = await extractDependencies(requirements1, packageFile);
      expect(res).toMatchSnapshot();
    });
  });
});
