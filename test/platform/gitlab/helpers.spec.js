const helpers = require('../../../lib/platform/gitlab/helpers');

describe('platform/gitlab/helpers', () => {
  describe('createFile(branchName, filePath, fileContents, message)', () => {
    it('creates file', async () => {
      await helpers.createFile(
        'some%2Frepo',
        'some-branch',
        'some-path',
        'some-contents',
        'some-message'
      );
    });
  });
  describe('updateFile(branchName, filePath, fileContents, message)', () => {
    it('updates file', async () => {
      await helpers.updateFile(
        'some%2Frepo',
        'some-branch',
        'some-path',
        'some-contents',
        'some-message'
      );
    });
  });
});
