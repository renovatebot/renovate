import type { CustomManager } from '../../../modules/manager/custom/types.ts';
import { CustomManagersMigration } from './custom-managers-migration.ts';
import { partial } from '~test/util.ts';

describe('config/migrations/custom/custom-managers-migration', () => {
  it('migrates', async () => {
    await expect(CustomManagersMigration).toMigrate(
      {
        customManagers: partial<CustomManager>([
          {
            managerFilePatterns: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'regex',
            managerFilePatterns: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ]),
      },
      {
        customManagers: [
          {
            customType: 'regex',
            managerFilePatterns: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'regex',
            managerFilePatterns: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      },
    );
  });
});
