import { readdirSync } from 'node:fs';
import { readFile } from 'fs-extra';

describe('modules/versioning/versioning-metadata', () => {
  const allVersioning = readdirSync('lib/modules/versioning', {
    withFileTypes: true,
  })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  describe.each(allVersioning)('%s', (versioning) => {
    it('readme with no h1 or h2 markdown headers', async () => {
      let readme = '';
      try {
        readme = await readFile(
          `lib/modules/versioning/${versioning}/readme.md`,
          'utf8',
        );
      } catch {
        // ignore missing file
      }
      const lines = readme.split('\n');
      let isCode = false;
      const res: string[] = [];

      for (const line of lines) {
        if (line.startsWith('```')) {
          isCode = !isCode;
        } else if (!isCode) {
          res.push(line);
        }
      }

      expect(
        res.some((line) => line.startsWith('# ') || line.startsWith('## ')),
      ).toBeFalse();
    });

    it('contains mandatory fields', async () => {
      const versioningObj = await import(`./${versioning}/index.ts`);
      expect(versioningObj.id).toEqual(versioning);
      expect(versioningObj.displayName).toBeDefined();
      expect(versioningObj.urls).toBeArray();
      expect(versioningObj.supportsRanges).toBeBoolean();
      if (versioningObj.supportsRanges === true) {
        expect(versioningObj.supportedRangeStrategies).toBeArrayOfStrings();
      }
    });
  });
});
