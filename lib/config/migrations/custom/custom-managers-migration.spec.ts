import type { CustomManager } from '../../../modules/manager/custom/types';
import { CustomManagersMigration } from './custom-managers-migration';
import { partial } from '~test/util';

describe('config/migrations/custom/custom-managers-migration', () => {
  it('migrates', () => {
    expect(CustomManagersMigration).toMigrate(
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
