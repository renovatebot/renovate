const platform = require('../../../lib/platform/dummy');

describe('platform/dummy', () => {
  beforeEach(() => {
    platform.initDummy();
  });

  it('should return the specified file list', () => {
    platform.createFile('a.txt', 'content a');
    platform.createFile('b.txt', 'content b');
    const fileList = platform.getFileList('master');

    expect(fileList).toEqual(['a.txt', 'b.txt']);
  });

  it('should return master files if branch is undefined', () => {
    platform.createFile('a.txt', 'content a');
    platform.createFile('b.txt', 'content b');
    const fileList = platform.getFileList(undefined);

    expect(fileList).toEqual(['a.txt', 'b.txt']);
  });

  it('should return the content of a given file', () => {
    platform.createFile('a.txt', 'content a');
    platform.createFile('b.txt', 'content b');
    const fieContent = platform.getFile('a.txt', 'master');

    expect(fieContent).toEqual('content a');
  });

  it('should indicate if a branch exists', () => {
    platform.createBranch('branch1');

    expect(platform.branchExists('branch1')).toBe(true);
  });

  it('should delete an existing branch', () => {
    platform.createBranch('branch1');
    platform.createBranch('branch2');
    platform.createBranch('branch3');

    platform.deleteBranch('branch2');
    expect(platform.branchExists('branch2')).toBe(false);
  });

  it('should return only files for a specific branch', () => {
    platform.createFile('a.txt', 'content a');
    platform.createFile('b.txt', 'content b');
    platform.createBranch('branch1');
    const filesInBranch1 = [
      {
        name: 'file1.txt',
        contents: 'file1 content',
      },
    ];
    platform.commitFilesToBranch(
      'branch1',
      filesInBranch1,
      'commit msg',
      undefined
    );

    const fileList = platform.getFileList('branch1');

    expect(fileList).toEqual(['file1.txt']);
  });

  it('should return all renovate branches', () => {
    platform.createBranch('branch1');
    platform.createBranch('branch2');
    platform.createBranch('renovate/branch1');
    platform.createBranch('renovate/branch3');

    expect(platform.getAllRenovateBranches('renovate/')).toEqual([
      'renovate/branch1',
      'renovate/branch3',
    ]);
  });
});
