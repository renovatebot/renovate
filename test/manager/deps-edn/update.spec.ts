/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/deps-edn/extract';
import { updateDependency } from '../../../lib/manager/deps-edn/update';

const depsEdn = readFileSync(
  resolve(__dirname, `./_fixtures/deps.edn`),
  'utf8'
);

describe('manager/deps-edn/update', () => {
  it('updateDependency', () => {
    const { deps } = extractPackageFile(depsEdn);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: `${dep.currentValue}-9999`,
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = updateDependency(depsEdn, upgrade);
    const cmpContent = depsEdn.replace(currentValue, newValue);
    expect(newFileContent).toEqual(cmpContent);
  });
});
