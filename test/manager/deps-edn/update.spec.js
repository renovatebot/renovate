/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/deps-edn/extract');
const { updateDependency } = require('../../../lib/manager/deps-edn/update');

const depsEdn = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/deps.edn`),
  'utf8'
);

describe('manager/deps-edn/update', () => {
  it('updateDependency', () => {
    const { deps } = extractPackageFile(depsEdn, 'deps.edn');
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
