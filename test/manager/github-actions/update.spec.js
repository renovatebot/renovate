const fs = require('fs');
const dcUpdate = require('../../../lib/manager/github-actions/update');

const workflow1 = fs.readFileSync(
  'test/manager/github-actions/_fixtures/main.workflow.1',
  'utf8'
);

describe('manager/github-actions/update', () => {
  describe('updateDependency', () => {
    it('replaces existing uses value', () => {
      const upgrade = {
        lineNumber: 11,
        depName: 'replicated/dockerfilelint',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(workflow1, upgrade);
      expect(res).not.toEqual(workflow1);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 11,
        depName: 'replicated/dockerfilelint',
      };
      const res = dcUpdate.updateDependency(workflow1, upgrade);
      expect(res).toEqual(workflow1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 12,
        newFrom: 'registry:2.6.2@sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(workflow1, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
