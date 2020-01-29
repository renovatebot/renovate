import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/cdnjs/extract';
import { updateDependency } from '../../../lib/manager/cdnjs/update';

const content = readFileSync(
  resolve(__dirname, `./_fixtures/sample.html`),
  'utf8'
);

describe('manager/cdnjs/update', () => {
  it('updates dependency', () => {
    const { deps } = extractPackageFile(content);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = updateDependency(content, upgrade);
    const cmpContent = content.replace(currentValue, newValue);
    expect(newFileContent).toEqual(cmpContent);
  });
  it('returns same string for already updated dependency', () => {
    const { deps } = extractPackageFile(content);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const { currentValue } = upgrade;
    const alreadyUpdated = content.replace(currentValue, '9.9.999');
    const newFileContent = updateDependency(alreadyUpdated, upgrade);
    expect(newFileContent).toBe(alreadyUpdated);
  });
  it('returns null if content has changed', () => {
    const { deps } = extractPackageFile(content);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const { currentValue } = upgrade;
    const alreadyUpdated = content.replace(currentValue, '2020.1');
    const newFileContent = updateDependency(alreadyUpdated, upgrade);
    expect(newFileContent).toBeNull();
  });
});
