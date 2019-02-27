const fs = require('fs');
const tmp = require('tmp-promise');
<<<<<<< HEAD

const {
  extractPackageFile,
  extractSetupFile,
=======
const { relative } = require('path');
const {
  extractPackageFile,
  // extractSetupFile,
>>>>>>> master
} = require('../../../lib/manager/pip_setup/extract');

const packageFile = 'test/_fixtures/pip_setup/setup.py';
const content = fs.readFileSync(packageFile, 'utf8');
const config = {
  localDir: '.',
};

<<<<<<< HEAD
=======
async function tmpFile() {
  const file = await tmp.file({ postfix: '.py' });
  return relative('.', file.path);
}

>>>>>>> master
describe('lib/manager/pip_setup/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns found deps', async () => {
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
    it('should return null for invalid file', async () => {
<<<<<<< HEAD
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
=======
      expect(
        await extractPackageFile('raise Exception()', await tmpFile(), config)
      ).toBe(null);
    });
    it('should return null for no deps file', async () => {
      expect(
        await extractPackageFile(
          'from setuptools import setup\nsetup()',
          await tmpFile(),
>>>>>>> master
          config
        )
      ).toBe(null);
    });
  });
<<<<<<< HEAD
=======
  /*
>>>>>>> master
  describe('extractSetupFile()', () => {
    it('should return parsed setup() call', async () => {
      expect(
        await extractSetupFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
    it('should support setuptools', async () => {
<<<<<<< HEAD
      const file = await tmp.file();
      expect(
        await extractSetupFile(
          'from setuptools import setup\nsetup(name="talisker")\n',
          file.path,
=======
      expect(
        await extractSetupFile(
          'from setuptools import setup\nsetup(name="talisker")\n',
          await tmpFile(),
>>>>>>> master
          config
        )
      ).toEqual({ name: 'talisker' });
    });
    it('should support distutils.core', async () => {
<<<<<<< HEAD
      const file = await tmp.file();
      expect(
        await extractSetupFile(
          'from distutils.core import setup\nsetup(name="talisker")\n',
          file.path,
=======
      expect(
        await extractSetupFile(
          'from distutils.core import setup\nsetup(name="talisker")\n',
          await tmpFile(),
>>>>>>> master
          config
        )
      ).toEqual({ name: 'talisker' });
    });
  });
<<<<<<< HEAD
=======
  */
>>>>>>> master
});
