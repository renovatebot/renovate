const fs = require('fs');
const tmp = require('tmp-promise');

const {
  extractPackageFile,
  extractSetupFile,
} = require('../../../lib/manager/pip_setup/extract');

const packageFile = 'test/_fixtures/pip_setup/setup.py';
const content = fs.readFileSync(packageFile, 'utf8');
const config = {
  localDir: '.',
};

describe('lib/manager/pip_setup/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns found deps', async () => {
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
    it('should return null for invalid file', async () => {
      const file = await tmp.file();
      expect(
        await extractPackageFile('raise Exception()', file.path, config)
      ).toBe(null);
    });
    it('should return null for no deps file', async () => {
      const file = await tmp.file();
      expect(
        await extractPackageFile(
          'from setuptools import setup\nsetup()',
          file.path,
          config
        )
      ).toBe(null);
    });
  });
  describe('extractSetupFile()', () => {
    it('should return parsed setup() call', async () => {
      expect(
        await extractSetupFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
  });
});
