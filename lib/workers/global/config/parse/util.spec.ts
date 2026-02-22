import { logger } from '../../../../logger/index.ts';
import { migrateAndValidateConfig } from './util.ts';

describe('workers/global/config/parse/util', () => {
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
