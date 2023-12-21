import { codeBlock } from 'common-tags';
import * as fragments from './fragments';
import { parse } from './parser';

describe('modules/manager/bazel-module/parser', () => {
  describe('parse', () => {
    it('returns empty string if invalid content', () => {
      const input = codeBlock`
      // This is invalid
      a + 1
      <<<<<<<
      `;
      const res = parse(input);
      expect(res).toHaveLength(0);
    });

    it('finds simple bazel_dep', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        bazel_dep(name = "rules_bar", version = "1.0.0", dev_dependency = True)
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_bar'),
            version: fragments.string('1.0.0'),
            dev_dependency: fragments.boolean(true),
          },
          true,
        ),
      ]);
    });

    it('finds the git_override', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        git_override(
          module_name = "rules_foo",
          remote = "https://github.com/example/rules_foo.git",
          commit = "6a2c2e22849b3e6b33d5ea9aa72222d4803a986a",
          patches = ["//:rules_foo.patch"],
          patch_strip = 1,
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('git_override'),
            module_name: fragments.string('rules_foo'),
            remote: fragments.string(
              'https://github.com/example/rules_foo.git',
            ),
            commit: fragments.string(
              '6a2c2e22849b3e6b33d5ea9aa72222d4803a986a',
            ),
          },
          true,
        ),
      ]);
    });

    it('finds archive_override', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        archive_override(
          module_name = "rules_foo",
          urls = [
            "https://example.com/archive.tar.gz",
          ],
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('archive_override'),
            module_name: fragments.string('rules_foo'),
          },
          true,
        ),
      ]);
    });

    it('finds local_path_override', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        local_path_override(
          module_name = "rules_foo",
          urls = "/path/to/repo",
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('local_path_override'),
            module_name: fragments.string('rules_foo'),
            urls: fragments.string('/path/to/repo'),
          },
          true,
        ),
      ]);
    });

    it('finds single_version_override', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        single_version_override(
          module_name = "rules_foo",
          version = "1.2.3",
          registry = "https://example.com/custom_registry",
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('single_version_override'),
            module_name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
            registry: fragments.string('https://example.com/custom_registry'),
          },
          true,
        ),
      ]);
    });
  });
});
