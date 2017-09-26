const dockerfile = require('../../../lib/workers/branch/dockerfile');
const logger = require('../../_fixtures/logger');

describe('workers/branch/dockerfile', () => {
  describe('setNewValue', () => {
    it('replaces existing value', () => {
      const currentFileContent =
        '# comment FROM node:8\nFROM node:8\nRUN something\n';
      const depName = 'node';
      const currentVersion = 'node:8';
      const newVersion = 'node:8@sha256:abcdefghijklmnop';
      const res = dockerfile.setNewValue(
        currentFileContent,
        depName,
        currentVersion,
        newVersion,
        logger
      );
      expect(res).toMatchSnapshot();
    });
  });
});
