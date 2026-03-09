import { readdirSync } from 'node:fs';
import { readFile } from 'fs-extra';
import { z } from 'zod/v4';

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
      const Base = z.object({
        id: z.string(),
        displayName: z.string(),
        urls: z.array(z.unknown()),
      });
      const VersioningMetadata = z.discriminatedUnion('supportsRanges', [
        Base.extend({
          supportsRanges: z.literal(true),
          supportedRangeStrategies: z.array(z.string()),
        }),
        Base.extend({
          supportsRanges: z.literal(false),
        }),
      ]);
      const versioningObj = VersioningMetadata.parse(
        await import(`./${versioning}/index.ts`),
      );
      expect(versioningObj.id).toEqual(versioning);
    });
  });
});
