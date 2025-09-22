import { transformRulesImgCalls } from './rules-img';

describe('modules/manager/bazel-module/rules-img', () => {
  describe('transformRulesImgCalls()', () => {
    it('ignores repo rule calls that are not rules_img', () => {
      const fragments = [
        {
          type: 'useRepoRule',
          variableName: 'other_rule',
          bzlFile: '@other_rules//some:rule.bzl',
          ruleName: 'other',
          isComplete: true,
        },
        {
          type: 'repoRuleCall',
          functionName: 'other_rule',
          children: {
            name: { type: 'string', value: 'test', isComplete: true },
            value: { type: 'string', value: 'something', isComplete: true },
          },
          isComplete: true,
          offset: 0,
          rawString: 'other_rule(name = "test", value = "something")',
        },
      ];

      const result = transformRulesImgCalls(fragments);

      expect(result).toEqual([]);
    });

    it('handles valid rules_img pull call', () => {
      const fragments = [
        {
          type: 'useRepoRule',
          variableName: 'pull',
          bzlFile: '@rules_img//img:pull.bzl',
          ruleName: 'pull',
          isComplete: true,
        },
        {
          type: 'repoRuleCall',
          functionName: 'pull',
          children: {
            name: { type: 'string', value: 'ubuntu', isComplete: true },
            repository: {
              type: 'string',
              value: 'library/ubuntu',
              isComplete: true,
            },
            tag: { type: 'string', value: '24.04', isComplete: true },
          },
          isComplete: true,
          offset: 0,
          rawString:
            'pull(name = "ubuntu", repository = "library/ubuntu", tag = "24.04")',
        },
      ];

      const result = transformRulesImgCalls(fragments);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        datasource: 'docker',
        depType: 'rules_img_pull',
        depName: 'ubuntu',
        packageName: 'library/ubuntu',
        currentValue: '24.04',
      });
    });

    it('skips repo rule calls without corresponding use_repo_rule', () => {
      const fragments = [
        {
          type: 'repoRuleCall',
          functionName: 'unknown_function',
          children: {
            name: { type: 'string', value: 'test', isComplete: true },
          },
          isComplete: true,
          offset: 0,
          rawString: 'unknown_function(name = "test")',
        },
      ];

      const result = transformRulesImgCalls(fragments);

      expect(result).toEqual([]);
    });

    it('skips malformed repo rule calls', () => {
      const fragments = [
        {
          type: 'useRepoRule',
          variableName: 'pull',
          bzlFile: '@rules_img//img:pull.bzl',
          ruleName: 'pull',
          isComplete: true,
        },
        {
          type: 'repoRuleCall',
          functionName: 'pull',
          children: {
            // Missing required fields like 'name' and 'repository'
            tag: { type: 'string', value: '24.04', isComplete: true },
          },
          isComplete: true,
          offset: 0,
          rawString: 'pull(tag = "24.04")',
        },
      ];

      const result = transformRulesImgCalls(fragments);

      expect(result).toEqual([]);
    });
  });
});
