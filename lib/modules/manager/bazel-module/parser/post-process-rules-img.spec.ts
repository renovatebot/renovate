import { extractRulesImgDependencies } from './post-process-rules-img';
import type { RepoRuleCallFragment, StringFragment } from './fragments';

describe('modules/manager/bazel-module/parser/post-process-rules-img', () => {
  describe('extractRulesImgDependencies', () => {
    it('returns empty array when no rules_img dependencies found', () => {
      const input = `
        bazel_dep(name = "rules_foo", version = "1.0.0")
        
        some_other_function()
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toEqual([]);
    });

    it('extracts basic rules_img pull dependency', () => {
      const input = `
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        
        pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'repoRuleCall',
        rule: 'pull',
        functionName: 'pull',
        module: '@rules_img//img:pull.bzl',
        children: {
          name: { type: 'string', value: 'ubuntu' },
          repository: { type: 'string', value: 'library/ubuntu' },
          tag: { type: 'string', value: '24.04' },
        },
      });
    });

    it('handles renamed pull function', () => {
      const input = `
        my_pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        
        my_pull(
            name = "nginx",
            repository = "library/nginx",
            tag = "1.27.1",
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'repoRuleCall',
        rule: 'pull',
        functionName: 'my_pull',
        module: '@rules_img//img:pull.bzl',
      });
    });

    it('ignores calls to undefined functions', () => {
      const input = `
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        
        # This call should be processed
        pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
        
        # This call should be ignored (undefined_function not registered)
        undefined_function(
            name = "something",
            repository = "repo/something",
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toHaveLength(1);
      const fragment = result[0] as RepoRuleCallFragment;
      expect((fragment.children.name as StringFragment).value).toBe('ubuntu');
    });

    it('handles multiple use_repo_rule assignments', () => {
      const input = `
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        other_pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        
        pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
        
        other_pull(
            name = "nginx",
            repository = "library/nginx",
            tag = "1.27.1",
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toHaveLength(2);
      const fragment1 = result[0] as RepoRuleCallFragment;
      const fragment2 = result[1] as RepoRuleCallFragment;
      expect((fragment1.children.name as StringFragment).value).toBe('ubuntu');
      expect((fragment2.children.name as StringFragment).value).toBe('nginx');
    });

    it('handles parameters with different quote styles', () => {
      const input = `
        pull = use_repo_rule('@rules_img//img:pull.bzl', 'pull')
        
        pull(
            name = 'ubuntu',
            repository = "library/ubuntu",
            tag = '24.04',
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect(result).toHaveLength(1);
      expect((result[0] as RepoRuleCallFragment).children).toMatchObject({
        name: { type: 'string', value: 'ubuntu' },
        repository: { type: 'string', value: 'library/ubuntu' },
        tag: { type: 'string', value: '24.04' },
      });
    });

    it('correctly sets rawString for replaceString', () => {
      const input = `
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        
        pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
      `;

      const result = extractRulesImgDependencies(input);
      expect((result[0] as RepoRuleCallFragment).rawString).toBe(`pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )`);
    });
  });
});
