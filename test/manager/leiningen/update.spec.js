/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const {
  extractPackageFile,
} = require('../../../lib/manager/leiningen/extract');
const { updateDependency } = require('../../../lib/manager/leiningen/update');

const leinProjectClj = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/project.clj`),
  'utf8'
);

describe('manager/leiningen/update', () => {
  it('updatePackageFile', () => {
    const { deps } = extractPackageFile(leinProjectClj);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: `${dep.currentValue}-9999`,
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = updateDependency(leinProjectClj, upgrade);
    const cmpContent = leinProjectClj.replace(currentValue, newValue);
    expect(newFileContent).toEqual(cmpContent);
  });
});
