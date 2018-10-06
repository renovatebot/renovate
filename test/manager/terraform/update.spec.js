const fs = require('fs');
const tfUpdate = require('../../../lib/manager/terraform/update');

const tf1 = fs.readFileSync('test/_fixtures/terraform/1.tf', 'utf8');

describe('manager/terraform/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depType: 'github',
        depName: 'foo',
        lineNumber: 1,
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.1',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).not.toEqual(tf1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depType: 'github',
        depName: 'foo',
        lineNumber: 1,
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toEqual(tf1);
    });
    it('returns null if wrong line', () => {
      const upgrade = {
        depType: 'github',
        depName: 'foo',
        lineNumber: 2,
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toBeNull();
    });
    it('replaces major updates > 1', () => {
      const upgrade = {
        depType: 'github',
        currentValue: 'v0.1.0',
        newValue: 'v0.1.3',
        depName: 'github.com/tieto-cem/terraform-aws-ecs-task-definition',
        depNameShort: 'tieto-cem/terraform-aws-ecs-task-definition',
        lineNumber: 14,
        moduleName: 'container_definition',
        purl: 'pkg:github/tieto-cem/terraform-aws-ecs-task-definition',
        source:
          'github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).not.toEqual(tf1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
  });
});
