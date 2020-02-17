import { readdir, readFile } from 'fs-extra';

describe('versioning metadata', () => {
  it('readme no markdown headers', async () => {
    const managers = (await readdir('lib/versioning')).filter(
      item => !item.includes('.')
    );
    for (const manager of managers) {
      let readme: string;
      try {
        readme = await readFile(
          'lib/versioning/' + manager + '/readme.md',
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
  it('mandatory fields', async () => {
    const managers = (await readdir('lib/versioning')).filter(
      item => !item.includes('.')
    );
    for (const manager of managers) {
      const managerObj = require(`../../lib/versioning/${manager}`);
      expect(managerObj.displayName).toBeDefined();
      expect(managerObj.urls).toBeDefined();
      expect(managerObj.supportsRanges).toBeDefined();
      if (managerObj.supportsRanges === true) {
        expect(managerObj.supportedRangeStrategies).toBeDefined();
      }
    }
  });
});
