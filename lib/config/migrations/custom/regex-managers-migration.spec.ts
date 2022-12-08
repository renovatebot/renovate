import { RegexManagersMigration } from './regex-managers-migration';

describe('config/migrations/custom/regex-managers-migration', () => {
  it('should migrate empty array', () => {
    expect(RegexManagersMigration).toMigrate(
      {
        regexManagers: [],
      },
      {
        customManagers: [],
      }
    );
  });

  it('should migrate populated array', () => {
    expect(RegexManagersMigration).toMigrate(
      {
        regexManagers: [{ fileMatch: ['README'], matchStrings: [''] }],
      },
      {
        customManagers: [{ fileMatch: ['README'], matchStrings: [''] }],
      }
    );
  });
});
