import { partial } from '../../../../../../test/util';
import type { BranchConfig, BranchUpgradeConfig } from '../../../../types';
import { getPrUpdatesTable } from './updates-table';

describe('workers/repository/update/pr/body/updates-table', () => {
  it('checks a case where prBodyColumns are undefined', () => {
    const configObj: BranchConfig = {
      manager: 'some-manager',
      branchName: 'some-branch',
      baseBranch: 'base',
      upgrades: [],
      prBodyColumns: undefined,
    };
    const result = getPrUpdatesTable(configObj);
    expect(result).toBe('');
  });

  it('checks results for getPrUpdatesTable', () => {
    const upgrade0 = partial<BranchUpgradeConfig>({
      manager: 'some-manager',
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
    });

    const upgrade1 = partial<BranchUpgradeConfig>({
      manager: 'some-manager',
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
    });

    const upgrade2 = partial<BranchUpgradeConfig>({
      manager: 'some-manager',
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
    });
    // TODO #22198 allow or filter undefined
    const upgrade3 = undefined as never;
    const configObj: BranchConfig = {
      manager: 'some-manager',
      branchName: 'some-branch',
      baseBranch: 'base',
      upgrades: [upgrade0, upgrade1, upgrade2, upgrade3],
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
    expect(result).toMatch(
      '\n' +
        '\n' +
        'This PR contains the following updates:\n' +
        '\n' +
        '| Package | Type | Update | Change |\n' +
        '|---|---|---|---|\n' +
        '|  |  | lockFileMaintenance | All locks refreshed |\n' +
        '| [koa](https://github.com/koajs/koa) | dependencies | pin | [`^1.7.0` -> `1.7.0`](https://renovatebot.com/diffs/npm/koa/1.7.0/1.7.0) |\n' +
        '| [mocha](https://mochajs.org/) ([source](https://github.com/mochajs/mocha)) | devDependencies | pin | [`^6.2.3` -> `6.2.3`](https://renovatebot.com/diffs/npm/mocha/6.2.3/6.2.3) |\n' +
        '\n' +
        '\n',
    );
  });
});
