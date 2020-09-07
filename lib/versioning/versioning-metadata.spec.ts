import { readFile, readdir } from 'fs-extra';

describe('versioning metadata', () => {
  it('readme no markdown headers', async () => {
    const allVersioning = (await readdir('lib/versioning')).filter(
      (item) => !item.includes('.')
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
        // eslint-disable-next-line jest/no-conditional-expect
        expect(RegExp(/(^|\n)#+ /).exec(readme)).toBeNull();
      }
    }
  });
  it('contains mandatory fields', async () => {
    const allVersioning = (await readdir('lib/versioning')).filter(
      (item) => !item.includes('.') && !item.startsWith('_')
    );

    for (const versioning of allVersioning) {
      const versioningObj = require(`./${versioning}`);
      expect(versioningObj.id).toEqual(versioning);
      expect(versioningObj.displayName).toBeDefined();
      expect(versioningObj.urls).toBeDefined();
      expect(versioningObj.supportsRanges).toBeDefined();
      if (versioningObj.supportsRanges === true) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(versioningObj.supportedRangeStrategies).toBeDefined();
      }
    }
  });
});
