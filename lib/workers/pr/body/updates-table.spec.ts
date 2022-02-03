import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { getPrUpdatesTable } from './updates-table';

describe('workers/pr/body/updates-table', () => {
  it('checks results for getPrUpdatesTable', () => {
    const upgrade0: BranchUpgradeConfig = {
      branchName: 'some-branch',
      prBodyDefinitions: {
        Package: '{{{depNameLinked}}}',
        Type: '{{{depType}}}',
        Update: '{{{updateType}}}',
        'Current value': '{{{currentValue}}}',
        'New value': '{{{newValue}}}',
        Change: 'All locks refreshed',
        Pending: '{{{displayPending}}}',
        References: '{{{references}}}',
        'Package file': '{{{packageFile}}}',
      },
      updateType: 'lockFileMaintenance',
    };

    const upgrade1: BranchUpgradeConfig = {
      branchName: 'some-branch',
      prBodyDefinitions: {
        Package: '{{{depNameLinked}}}',
        Type: '{{{depType}}}',
        Update: '{{{updateType}}}',
        'Current value': '{{{currentValue}}}',
        'New value': '{{{newValue}}}',
        Change:
          "[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
        Pending: '{{{displayPending}}}',
        References: '{{{references}}}',
        'Package file': '{{{packageFile}}}',
      },
      updateType: 'pin',
      depNameLinked: '[koa](https://github.com/koajs/koa)',
      depName: 'koa',
      depType: 'dependencies',
      currentValue: '^1.7.0',
      newValue: '1.7.0',
      currentVersion: '1.7.0',
      newVersion: '1.7.0',
      displayFrom: '^1.7.0',
      displayTo: '1.7.0',
    };

    const upgrade2: BranchUpgradeConfig = {
      branchName: 'some-branch',
      prBodyDefinitions: {
        Package: '{{{depNameLinked}}}',
        Type: '{{{depType}}}',
        Update: '{{{updateType}}}',
        'Current value': '{{{currentValue}}}',
        'New value': '{{{newValue}}}',
        Change:
          "[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
        Pending: '{{{displayPending}}}',
        References: '{{{references}}}',
        'Package file': '{{{packageFile}}}',
      },
      updateType: 'pin',
      depNameLinked:
        '[mocha](https://mochajs.org/) ([source](https://github.com/mochajs/mocha))',
      depType: 'devDependencies',
      depName: 'mocha',
      currentValue: '^6.2.3',
      newValue: '6.2.3',
      currentVersion: '6.2.3',
      newVersion: '6.2.3',
      displayFrom: '^6.2.3',
      displayTo: '6.2.3',
    };
    const configObj: BranchConfig = {
      branchName: 'some-branch',
      upgrades: [upgrade0, upgrade1, upgrade2],
      prBodyColumns: ['Package', 'Type', 'Update', 'Change', 'Pending'],
      prBodyDefinitions: {
        Package: '{{{depNameLinked}}}',
        Type: '{{{depType}}}',
        Update: '{{{updateType}}}',
        'Current value': '{{{currentValue}}}',
        'New value': '{{{newValue}}}',
        Change: 'All locks refreshed',
        Pending: '{{{displayPending}}}',
        References: '{{{references}}}',
        'Package file': '{{{packageFile}}}',
      },
    };
    const result = getPrUpdatesTable(configObj);
    expect(result).toContain('6.2.3');
    expect(result).toContain('1.7.0');
    expect(result).toContain('All locks refreshed');
  });
});
