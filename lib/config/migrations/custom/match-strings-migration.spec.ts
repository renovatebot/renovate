import { MatchStringsMigration } from './match-strings-migration';

describe('config/migrations/custom/match-strings-migration', () => {
  it('should migrate properly', () => {
    expect(MatchStringsMigration).toMigrate(
      {
        matchStrings: [
          undefined,
          '(?<lookupName>',
          null,
          '(?<lookupName>(?<lookupName>',
          '',
        ],
      },
      {
        matchStrings: ['(?<packageName>', '(?<packageName>(?<packageName>'],
      },
    );
  });
});
