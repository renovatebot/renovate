import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/cdnjs/extract';
import { updateDependency } from '../../../lib/manager/cdnjs/update';

const content = readFileSync(
  resolve(__dirname, `./_fixtures/sample.html`),
  'utf8'
);

describe('manager/cdnjs/update', () => {
  it('updateDependency', () => {
    const { deps } = extractPackageFile(content);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: `9.9.999`,
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = updateDependency(content, upgrade);
    const cmpContent = content.replace(currentValue, newValue);
    expect(newFileContent).toEqual(cmpContent);
  });
});
