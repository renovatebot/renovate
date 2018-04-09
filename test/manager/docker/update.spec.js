const dockerfile = require('../../../lib/manager/docker/update');

describe('workers/branch/dockerfile', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const fileContent = '# comment FROM node:8\nFROM node:8\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: '',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('replaces existing value with suffix', () => {
      const fileContent =
        '# comment FROM node:8\nFROM node:8 as base\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: 'as base',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('handles strange whitespace', () => {
      const fileContent =
        '# comment FROM node:8\nFROM   node:8 as base\nRUN something\n';
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: 'as base',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null on error', () => {
      const fileContent = null;
      const upgrade = {
        depName: 'node',
        currentVersion: 'node:8',
        fromPrefix: 'FROM',
        fromSuffix: '',
        newFrom: 'node:8@sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toBe(null);
    });
    it('handles similar FROM', () => {
      const fileContent =
        'FROM debian:wheezy as stage-1\nRUN something\nFROM debian:wheezy\nRUN something else';
      const upgrade1 = {
        depName: 'debian',
        currentVersion: 'debian:wheezy',
        fromPrefix: 'FROM',
        fromSuffix: 'as stage-1',
        newFrom: 'debian:wheezy@sha256:abcdefghijklmnop',
      };
      const upgrade2 = {
        depName: 'debian',
        currentVersion: 'debian:wheezy',
        fromPrefix: 'FROM',
        fromSuffix: '',
        newFrom: 'debian:wheezy@sha256:abcdefghijklmnop',
      };
      let res = dockerfile.updateDependency(fileContent, upgrade1);
      res = dockerfile.updateDependency(res, upgrade2);
      expect(res).toMatchSnapshot();
      expect(res.includes('as stage-1')).toBe(true);
    });
  });
});
