import { partial } from '../../../../test/util';
import type { CustomManager } from '../../../modules/manager/custom/types';
import { CustomManagersMigration } from './custom-managers-migration';

describe('config/migrations/custom/custom-managers-migration', () => {
  it('migrates', () => {
    expect(CustomManagersMigration).toMigrate(
      {
        customManagers: partial<CustomManager>([
          {
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'regex',
            fileMatch: ['js', '***$}{]]['],
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
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'regex',
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      },
    );
  });
});
