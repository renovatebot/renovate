const yarnHelper = require('../../lib/helpers/yarn');

describe('generateLockFile(newPackageJson, npmrcContent, yarnrcContent)', () => {});

describe('getLockFile(packageJson, config)', () => {
  let api;
  beforeEach(() => {
    api = {
      getFileContent: jest.fn(),
    };
  });
  it('returns null if no existing yarn.lock', async () => {
    api.getFileContent.mockReturnValueOnce(false);
    expect(await yarnHelper.getLockFile('package.json', '', api)).toBe(null);
  });
  it('returns yarn.lock file', async () => {
    api.getFileContent.mockReturnValueOnce('Existing yarn.lock');
    api.getFileContent.mockReturnValueOnce(null); // npmrc
    api.getFileContent.mockReturnValueOnce(null); // yarnrc
    yarnHelper.generateLockFile = jest.fn();
    yarnHelper.generateLockFile.mockReturnValueOnce('New yarn.lock');
    const yarnLockFile = {
      name: 'yarn.lock',
      contents: 'New yarn.lock',
    };
    expect(await yarnHelper.getLockFile('package.json', '', api)).toMatchObject(yarnLockFile);
  });
});

describe('maintainLockFile(inputConfig)', () => {});
