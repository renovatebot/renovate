const fs = require('fs');
const bkUpdate = require('../../../lib/manager/buildkite/update');

const pipeline1 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline1.yml',
  'utf8'
);
const pipeline2 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline2.yml',
  'utf8'
);
const pipeline4 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline4.yml',
  'utf8'
);

describe('manager/buildkite/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 2,
        newValue: 'v2.2.0',
      };
      const res = bkUpdate.updateDependency(pipeline1, upgrade);
      expect(res).not.toEqual(pipeline1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces arrays', () => {
      const upgrade = {
        lineNumber: 10,
        newValue: 'v2.2.0',
      };
      const res = bkUpdate.updateDependency(pipeline4, upgrade);
      expect(res).not.toEqual(pipeline4);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        lineNumber: 4,
        newValue: 'v1.5.0',
      };
      const res1 = bkUpdate.updateDependency(pipeline2, upgrade1);
      expect(res1).not.toEqual(pipeline2);
      expect(res1.includes(upgrade1.newValue)).toBe(true);
      const upgrade2 = {
        lineNumber: 15,
        newValue: 'v1.5.0',
      };
      const res2 = bkUpdate.updateDependency(res1, upgrade2);
      expect(res2).not.toEqual(res1);
      expect(res2).toMatchSnapshot();
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 2,
        newValue: 'v2.0.0',
      };
      const res = bkUpdate.updateDependency(pipeline1, upgrade);
      expect(res).toEqual(pipeline1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 3,
        newValue: 'v2.2.0',
      };
      const res = bkUpdate.updateDependency(pipeline1, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = bkUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
