import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile, updateDependency } from '.';
import _got from '../../util/got';

const got: jest.Mock<any> = _got as any;
jest.mock('../../util/got');

const fileContent = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.html`),
  'utf8'
);

const axiosJson = JSON.parse(
  readFileSync(resolve(__dirname, `./__fixtures__/axios.json`), 'utf8')
);

describe('manager/html/update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    return global.renovateCache.rmAll();
  });
  it('updates dependency', async () => {
    got.mockResolvedValueOnce({ body: axiosJson });
    const { deps } = extractPackageFile(fileContent);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '0.19.2',
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = await updateDependency({ fileContent, upgrade });
    const cmpContent = fileContent
      .replace(currentValue, newValue)
      .replace(
        'sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=',
        'sha256-T/f7Sju1ZfNNfBh7skWn0idlCBcI3RwdLSS4/I7NQKQ='
      );
    expect(newFileContent).toEqual(cmpContent);
  });
  it('returns same string for already updated dependency', async () => {
    const { deps } = extractPackageFile(fileContent);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const { currentValue } = upgrade;
    const alreadyUpdated = fileContent
      .replace(currentValue, '9.9.999')
      .replace(
        'sha256-mpnrJ5DpEZZkwkE1ZgkEQQJW/46CSEh/STrZKOB/qoM=',
        'sha256-T/f7Sju1ZfNNfBh7skWn0idlCBcI3RwdLSS4/I7NQKQ='
      );
    const newFileContent = await updateDependency({
      fileContent: alreadyUpdated,
      upgrade,
    });
    expect(newFileContent).toBe(alreadyUpdated);
  });
  it('returns null if content has changed', async () => {
    const { deps } = extractPackageFile(fileContent);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const { currentValue } = upgrade;
    const alreadyUpdated = fileContent.replace(currentValue, '2020.1');
    const newFileContent = await updateDependency({
      fileContent: alreadyUpdated,
      upgrade,
    });
    expect(newFileContent).toBeNull();
  });
  it('returns null if hash is not found', async () => {
    got.mockResolvedValueOnce({ body: axiosJson });
    const { deps } = extractPackageFile(fileContent);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: '9.9.999',
    };
    const newFileContent = await updateDependency({ fileContent, upgrade });
    expect(newFileContent).toBeNull();
  });
});
