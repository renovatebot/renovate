import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/github-actions/update';

const workflow1 = readFileSync(
  'test/manager/github-actions/_fixtures/main.workflow.1',
  'utf8'
);

const workflow2 = readFileSync(
  'test/manager/github-actions/_fixtures/workflow.yml.1',
  'utf8'
);

describe('manager/github-actions/update', () => {
  describe('updateDependency', () => {
    it('replaces existing uses value', () => {
      const upgrade = {
        managerData: { lineNumber: 11 },
        depName: 'replicated/dockerfilelint',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency(workflow1, upgrade);
      expect(res).not.toEqual(workflow1);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 11 },
        depName: 'replicated/dockerfilelint',
      };
      const res = updateDependency(workflow1, upgrade);
      expect(res).toEqual(workflow1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 12 },
        newFrom: 'registry:2.6.2@sha256:abcdefghijklmnop',
      };
      const res = updateDependency(workflow1, upgrade);
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });
    it('replaces existing uses value in yaml file', () => {
      const upgrade = {
        managerData: { lineNumber: 17 },
        depName: 'replicated/dockerfilelint',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency(workflow2, upgrade);
      expect(res).not.toEqual(workflow2);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same in yaml file', () => {
      const upgrade = {
        managerData: { lineNumber: 17 },
        depName: 'replicated/dockerfilelint',
      };
      const res = updateDependency(workflow2, upgrade);
      expect(res).toEqual(workflow2);
    });
    it('returns null if mismatch in yaml file', () => {
      const upgrade = {
        managerData: { lineNumber: 12 },
        newFrom: 'registry:2.6.2@sha256:abcdefghijklmnop',
      };
      const res = updateDependency(workflow2, upgrade);
      expect(res).toBeNull();
    });
  });
});
