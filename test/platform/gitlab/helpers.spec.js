const helpers = require('../../../lib/platform/gitlab/helpers');

jest.mock('../../../lib/platform/gitlab/gl-got-wrapper');
const get = require('../../../lib/platform/gitlab/gl-got-wrapper');

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
      expect(get.post.mock.calls).toMatchSnapshot();
      expect(get.post.mock.calls[0][1].body.file_path).not.toBeDefined();
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
      expect(get.put.mock.calls).toMatchSnapshot();
      expect(get.put.mock.calls[0][1].body.file_path).not.toBeDefined();
    });
  });
});
