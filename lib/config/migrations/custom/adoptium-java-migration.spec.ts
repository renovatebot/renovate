import { AdoptiumJavaMigration } from './adoptium-java-migration';

describe('config/migrations/custom/adoptium-java-migration', () => {
  it('should rename adoptium-java to java-version', () => {
    expect(AdoptiumJavaMigration).toMigrate(
      {
        'adoptium-java': {
          datasource: 'adoptium-java',
        },
      },
      {
        'java-version': {
          datasource: 'adoptium-java',
        },
      }
    );
  });

  it('should remove property from config if its an empty object', () => {
    expect(AdoptiumJavaMigration).toMigrate(
      {
        'adoptium-java': {},
      },
      {}
    );
  });
});
