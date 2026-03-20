import { ExtractVersionMigration } from './extract-version-migration';

describe('config/migrations/custom/extract-version-migration', () => {
  it('migrates string extractVersion to array format', async () => {
    await expect(ExtractVersionMigration).toMigrate(
      {
        extractVersion: '^v(?<version>.*)$',
      } as any,
      {
        extractVersion: ['^v(?<version>.*)$'],
      } as any,
    );
  });

  it('migrates complex regex pattern to array format', async () => {
    await expect(ExtractVersionMigration).toMigrate(
      {
        extractVersion: '^release-(?<version>.+)$',
      } as any,
      {
        extractVersion: ['^release-(?<version>.+)$'],
      } as any,
    );
  });

  it('does not migrate array extractVersion', async () => {
    await expect(ExtractVersionMigration).toMigrate(
      {
        extractVersion: [
          '^v(?<version>.*)-(?<prerelease>.*)$',
          '{{version}}-{{prerelease}}.final',
        ],
      } as any,
      {
        extractVersion: [
          '^v(?<version>.*)-(?<prerelease>.*)$',
          '{{version}}-{{prerelease}}.final',
        ],
      } as any,
      false,
    );
  });

  it('does not migrate undefined extractVersion', async () => {
    await expect(ExtractVersionMigration).toMigrate(
      {
        otherProperty: 'value',
      } as any,
      {
        otherProperty: 'value',
      } as any,
      false,
    );
  });

  it('does not migrate null extractVersion', async () => {
    await expect(ExtractVersionMigration).toMigrate(
      {
        extractVersion: null,
      } as any,
      {
        extractVersion: null,
      } as any,
      false,
    );
  });
});
