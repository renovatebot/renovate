import * as dockerfile from '../../../lib/manager/dockerfile/update';

describe('manager/dockerfile/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const fileContent = '# comment FROM node:8\nFROM node:8\nRUN something\n';
      const upgrade = {
        managerData: { lineNumber: 1, fromPrefix: 'FROM', fromSuffix: '' },
        depName: 'node',
        newValue: '8.1-alpine',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('replaces existing value with suffix', () => {
      const fileContent =
        '# comment FROM node:8\nFROM node:8 as base\nRUN something\n';
      const upgrade = {
        managerData: {
          lineNumber: 1,
          fromPrefix: 'FROM',
          fromSuffix: 'as base',
        },
        depName: 'node',
        newValue: '8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('handles strange whitespace', () => {
      const fileContent =
        '# comment FROM node:8\nFROM   node:8 as base\nRUN something\n';
      const upgrade = {
        managerData: {
          lineNumber: 1,
          fromPrefix: 'FROM',
          fromSuffix: 'as base',
        },
        depName: 'node',
        newValue: '8',

        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null if mismatch', () => {
      const fileContent =
        '# comment FROM node:8\nFROM   node:8 as base\nRUN something\n';
      const upgrade = {
        managerData: { lineNumber: 0, fromPrefix: 'FROM', fromSuffix: '' },
        depName: 'node',
        newValue: '8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toBeNull();
    });
    it('returns unchanged', () => {
      const fileContent =
        '# comment FROM node:8\nFROM node:8 as base\nRUN something\n';
      const upgrade = {
        managerData: {
          lineNumber: 1,
          fromPrefix: 'FROM',
          fromSuffix: 'as base',
        },
        depName: 'node',
        newValue: '8',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toBe(fileContent);
    });
    it('returns null on error', () => {
      const fileContent = null;
      const upgrade = {
        managerData: { lineNumber: 1, fromPrefix: 'FROM', fromSuffix: '' },
        depName: 'node',
        newValue: '8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toBeNull();
    });
    it('handles similar FROM', () => {
      const fileContent =
        'FROM debian:wheezy as stage-1\nRUN something\nFROM debian:wheezy\nRUN something else';
      const upgrade1 = {
        managerData: {
          lineNumber: 0,
          fromPrefix: 'FROM',
          fromSuffix: 'as stage-1',
        },
        depName: 'debian',
        newValue: 'wheezy',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const upgrade2 = {
        managerData: { lineNumber: 2, fromPrefix: 'FROM', fromSuffix: '' },
        depName: 'debian',
        newValue: 'wheezy',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      let res = dockerfile.updateDependency(fileContent, upgrade1);
      res = dockerfile.updateDependency(res, upgrade2);
      expect(res).toMatchSnapshot();
      expect(res.includes('as stage-1')).toBe(true);
    });
    it('replaces COPY --from', () => {
      const fileContent =
        'FROM scratch\nCOPY --from=gcr.io/k8s-skaffold/skaffold:v0.11.0 /usr/bin/skaffold /usr/bin/skaffold\n';
      const upgrade = {
        managerData: {
          lineNumber: 1,
          fromPrefix: 'COPY --from=',
          fromSuffix: '/usr/bin/skaffold /usr/bin/skaffold',
        },
        depName: 'gcr.io/k8s-skaffold/skaffold',
        newValue: 'v0.12.0',
      };
      const res = dockerfile.updateDependency(fileContent, upgrade);
      expect(res).toMatchSnapshot();
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
  });
});
