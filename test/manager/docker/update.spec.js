const dockerfile = require('../../../lib/manager/docker/update');

describe('workers/branch/dockerfile', () => {
  describe('setNewValue', () => {
    it('replaces existing value', () => {
      const currentFileContent =
        '# comment FROM node:8\nFROM node:8\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: '',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.setNewValue(currentFileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('replaces existing value with suffix', () => {
      const currentFileContent =
        '# comment FROM node:8\nFROM node:8 as base\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: 'as base',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.setNewValue(currentFileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('handles strange whitespace', () => {
      const currentFileContent =
        '# comment FROM node:8\nFROM   node:8 as base\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: 'as base',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.setNewValue(currentFileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null on error', () => {
      const currentFileContent = null;
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: '',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.setNewValue(currentFileContent, upgrade);
      expect(res).toBe(null);
    });
  });
});
