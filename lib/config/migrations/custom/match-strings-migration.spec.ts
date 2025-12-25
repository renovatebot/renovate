import { MatchStringsMigration } from './match-strings-migration';
import { logger } from '~test/util';

describe('config/migrations/custom/match-strings-migration', () => {
  it('should migrate properly', async () => {
    await expect(MatchStringsMigration).toMigrate(
      {
        matchStrings: [
          undefined,
          '(?<lookupName>',
          null,
          '(?<lookupName>(?<lookupName>',
          '',
          '/someregex/',
        ],
      },
      {
        matchStrings: [
          '(?<packageName>',
          '(?<packageName>(?<packageName>',
          'someregex',
        ],
      },
    );
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { matchString: '/someregex/' },
      'Found leading and trailing slashes in match string, removing them. "matchStrings" work fine without the slashes, please consider removing them',
    );
  });
});
