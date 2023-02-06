import { DotnetMigration } from './dotnet-migration';

describe('config/migrations/custom/dotnet-migration', () => {
  it('should rename dotnet to dotnet-version', () => {
    expect(DotnetMigration).toMigrate(
      {
        dotnet: {
          datasource: 'dotnet',
          depName: 'dotnet-sdk',
        },
      },
      {
        'dotnet-version': {
          datasource: 'dotnet',
          depName: 'dotnet-sdk',
        },
      }
    );
  });

  it('should delete dotnet if object is empty', () => {
    expect(DotnetMigration).toMigrate(
      {
        dotnet: {},
      },
      {}
    );
  });
});
