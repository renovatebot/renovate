import { partial } from '../../../../test/util';
import type { CustomManager } from '../../types';
import { RegexManagersMigration } from './regex-managers-migration';

describe('config/migrations/custom/regex-managers-migration', () => {
  it('migrates', () => {
    expect(RegexManagersMigration).toMigrate(
      {
        regexManagers: partial<CustomManager>([
          {
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'jsonata',
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ]),
      },
      {
        regexManagers: [
          {
            customType: 'regex',
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
          {
            customType: 'jsonata',
            fileMatch: ['js', '***$}{]]['],
            matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
            datasourceTemplate: 'maven',
            versioningTemplate: 'gradle',
          },
        ],
      }
    );
  });
});
