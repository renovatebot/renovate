import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/buildkite/update';

const pipeline1 = readFileSync(
  'test/manager/buildkite/_fixtures/pipeline1.yml',
  'utf8'
);
const pipeline2 = readFileSync(
  'test/manager/buildkite/_fixtures/pipeline2.yml',
  'utf8'
);
const pipeline4 = readFileSync(
  'test/manager/buildkite/_fixtures/pipeline4.yml',
  'utf8'
);

describe('manager/buildkite/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 2 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency(pipeline1, upgrade);
      expect(res).not.toEqual(pipeline1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces arrays', () => {
      const upgrade = {
        managerData: { lineNumber: 10 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency(pipeline4, upgrade);
      expect(res).not.toEqual(pipeline4);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        managerData: { lineNumber: 4 },
        newValue: 'v1.5.0',
      };
      const res1 = updateDependency(pipeline2, upgrade1);
      expect(res1).not.toEqual(pipeline2);
      expect(res1.includes(upgrade1.newValue)).toBe(true);
      const upgrade2 = {
        managerData: { lineNumber: 15 },
        newValue: 'v1.5.0',
      };
      const res2 = updateDependency(res1, upgrade2);
      expect(res2).not.toEqual(res1);
      expect(res2).toMatchSnapshot();
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 2 },
        newValue: 'v2.0.0',
      };
      const res = updateDependency(pipeline1, upgrade);
      expect(res).toEqual(pipeline1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 3 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency(pipeline1, upgrade);
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });
  });
});
