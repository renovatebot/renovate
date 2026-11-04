import { getConfigFileNames } from '../../../../config/app-strings.ts';
import { logger } from '../../../../logger/index.ts';
import { readSystemFile } from '../../../../util/fs/index.ts';
import { getParsedContent, migrateAndValidateConfig } from './util.ts';

vi.mock('../../../../util/fs/index.ts');

describe('workers/global/config/parse/util', () => {
  describe('getParsedContent()', () => {
    it.each(getConfigFileNames())('parses %s', async (file) => {
      vi.mocked(readSystemFile).mockResolvedValueOnce('{"token":"abc"}');

      const result = await getParsedContent(file);

      expect(result).toMatchObject({ token: 'abc' });
    });

    it.each`
      file              | content
      ${'config.jsonc'} | ${'{"token":"abc"} // comment'}
      ${'config.json5'} | ${'{"token":"abc",}'}
      ${'config.yaml'}  | ${'token: abc'}
      ${'config.yml'}   | ${'token: abc'}
    `('parses $file', async ({ file, content }) => {
      vi.mocked(readSystemFile).mockResolvedValueOnce(content);

      const result = await getParsedContent(file);

      expect(result).toMatchObject({ token: 'abc' });
    });

    it('throws for unsupported file type', async () => {
      await expect(getParsedContent('config.txt')).rejects.toThrow(
        'Unsupported file type',
      );
    });
  });

  it('massages config', async () => {
    const config = {
      packageRules: [
        {
          description: 'haha',
          matchPackageNames: ['name'],
          enabled: false,
        },
      ],
    };

    const migratedConfig = await migrateAndValidateConfig(config, 'global');
    expect(migratedConfig?.packageRules?.[0].description).toBeArray();
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });
});
