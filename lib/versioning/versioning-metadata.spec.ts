import { readdir, readFile } from 'fs-extra';

describe('versioning metadata', () => {
  it('readme no markdown headers', async () => {
    const allVersioning = (await readdir('lib/versioning')).filter(
      item => !item.includes('.')
    );
    for (const versioning of allVersioning) {
      let readme: string;
      try {
        readme = await readFile(
          'lib/versioning/' + versioning + '/readme.md',
          'utf8'
        );
      } catch (err) {
        // ignore missing file
      }
      if (readme) {
        expect(RegExp(/(^|\n)#+ /).exec(readme)).toBe(null);
      }
    }
  });
  it('contains mandatory fields', async () => {
    const allVersioning = (await readdir('lib/versioning')).filter(
      item => !item.includes('.') && !item.startsWith('_')
    );

    for (const versioning of allVersioning) {
      const versioningObj = require(`../../lib/versioning/${versioning}`);
      expect(versioningObj.id).toEqual(versioning);
      expect(versioningObj.displayName).toBeDefined();
      expect(versioningObj.urls).toBeDefined();
      expect(versioningObj.supportsRanges).toBeDefined();
      if (versioningObj.supportsRanges === true) {
        expect(versioningObj.supportedRangeStrategies).toBeDefined();
      }
    }
  });
});
