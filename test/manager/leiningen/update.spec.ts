/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/leiningen/extract';
import { updateDependency } from '../../../lib/manager/leiningen/update';

const leinProjectClj = readFileSync(
  resolve(__dirname, `./_fixtures/project.clj`),
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
