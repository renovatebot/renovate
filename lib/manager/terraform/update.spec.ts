import { readFileSync } from 'fs';
import { updateDependency } from './update';

const tf1 = readFileSync('test/datasource/terraform/_fixtures/1.tf', 'utf8');

describe('manager/terraform/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depType: 'github',
        depName: 'foo',
        managerData: { lineNumber: 1 },
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.1',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).not.toEqual(tf1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('returns same', () => {
      const updateOptions = {
        depType: 'github',
        depName: 'foo',
        managerData: { lineNumber: 1 },
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).toEqual(tf1);
    });
    it('returns null if wrong line', () => {
      const updateOptions = {
        depType: 'github',
        depName: 'foo',
        managerData: { lineNumber: 2 },
        depNameShort: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).toBeNull();
    });
    it('updates github versions', () => {
      const updateOptions = {
        depType: 'github',
        currentValue: 'v0.1.0',
        newValue: 'v0.1.3',
        depName: 'github.com/tieto-cem/terraform-aws-ecs-task-definition',
        depNameShort: 'tieto-cem/terraform-aws-ecs-task-definition',
        managerData: { lineNumber: 14 },
        moduleName: 'container_definition',
        source:
          'github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).not.toEqual(tf1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('skips terraform versions wrong line', () => {
      const updateOptions = {
        currentValue: '0.1.0',
        depName: 'hashicorp/consul/aws',
        depNameShort: 'hashicorp/consul/aws',
        depType: 'terraform',
        managerData: { lineNumber: 11 },
        moduleName: 'consul',
        source: 'hashicorp/consul/aws',
        newValue: '0.4.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).toBeNull();
    });
    it('updates terraform versions', () => {
      const updateOptions = {
        currentValue: '0.1.0',
        depName: 'hashicorp/consul/aws',
        depNameShort: 'hashicorp/consul/aws',
        depType: 'terraform',
        managerData: { lineNumber: 10 },
        moduleName: 'consul',
        source: 'hashicorp/consul/aws',
        newValue: '0.4.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).not.toEqual(tf1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('updates terraform versions with terraformDependencyType `module` ', () => {
      const updateOptions = {
        currentValue: '0.1.0',
        depName: 'hashicorp/consul/aws',
        depNameShort: 'hashicorp/consul/aws',
        depType: 'terraform',
        managerData: {
          lineNumber: 10,
          terraformDependencyType: 'module',
        },
        moduleName: 'consul',
        source: 'hashicorp/consul/aws',
        newValue: '0.4.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).not.toEqual(tf1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('updates terraform versions with terraformDependencyType `provider` ', () => {
      const updateOptions = {
        currentValue: '1.36.1',
        depName: 'azurerm',
        depNameShort: 'azurerm',
        depType: 'terraform',
        managerData: {
          lineNumber: 99,
          terraformDependencyType: 'provider',
        },
        moduleName: 'azurerm',
        source:
          'https://github.com/terraform-providers/terraform-provider-azurerm',
        newValue: '1.38.0',
      };
      const res = updateDependency({ fileContent: tf1, updateOptions });
      expect(res).not.toEqual(tf1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
  });
});
