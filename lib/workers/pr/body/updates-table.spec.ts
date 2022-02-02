import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { getPrUpdatesTable } from './updates-table';

describe('workers/pr/body/updates-table', () => {
  it('checks results for getPrUpdatesTable', () => {
    const configObj: BranchConfig = {
      branchName: 'some-branch',
      upgrades: [],
      prBodyColumns: ['Package', 'Type', 'Update', 'Change', 'Pending'],
    };
    const upgrade0: BranchUpgradeConfig = { branchName: 'some-branch' };
    upgrade0.prBodyDefinitions = {
      Package: '{{{depNameLinked}}}',
      Type: '{{{depType}}}',
      Update: '{{{updateType}}}',
      'Current value': '{{{currentValue}}}',
      'New value': '{{{newValue}}}',
      Change: 'All locks refreshed',
      Pending: '{{{displayPending}}}',
      References: '{{{references}}}',
      'Package file': '{{{packageFile}}}',
    };
    upgrade0.updateType = 'lockFileMaintenance';
    const upgrade1: BranchUpgradeConfig = { branchName: 'some-branch' };
    upgrade1.prBodyDefinitions = {
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
    };
    upgrade1.updateType = 'pin';
    upgrade1.depNameLinked = '[koa](https://github.com/koajs/koa)';
    upgrade1.depName = 'koa';
    upgrade1.depType = 'dependencies';
    upgrade1.currentValue = '^1.7.0';
    upgrade1.newValue = '1.7.0';
    upgrade1.currentVersion = '1.7.0';
    upgrade1.newVersion = '1.7.0';
    upgrade1.displayFrom = '^1.7.0';
    upgrade1.displayTo = '1.7.0';
    const upgrade2: BranchUpgradeConfig = { branchName: 'some-branch' };
    upgrade2.prBodyDefinitions = {
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
    };
    upgrade2.updateType = 'pin';
    upgrade2.depNameLinked =
      '[mocha](https://mochajs.org/) ([source](https://github.com/mochajs/mocha))';
    upgrade2.depType = 'devDependencies';
    upgrade2.depName = 'mocha';
    upgrade2.currentValue = '^6.2.3';
    upgrade2.newValue = '6.2.3';
    upgrade2.currentVersion = '6.2.3';
    upgrade2.newVersion = '6.2.3';
    upgrade2.displayFrom = '^6.2.3';
    upgrade2.displayTo = '6.2.3';
    configObj.upgrades.push(upgrade0);
    configObj.upgrades.push(upgrade1);
    configObj.upgrades.push(upgrade2);
    const result = getPrUpdatesTable(configObj);
    expect(result).toContain('6.2.3');
    expect(result).toContain('1.7.0');
    expect(result).toContain('All locks refreshed');
  });
});
