import { codeBlock } from 'common-tags';
import * as fragments from '../fragments';
import { parse } from '.';

describe('modules/manager/bazel-module/parser/index', () => {
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
            commit: fragments.string(
              '6a2c2e22849b3e6b33d5ea9aa72222d4803a986a',
            ),
            remote: fragments.string(
              'https://github.com/example/rules_foo.git',
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

    it('finds maven.artifact', () => {
      const input = codeBlock`
        maven.artifact(
            artifact = "core.specs.alpha",
            exclusions = ["org.clojure:clojure"],
            group = "org.clojure",
            version = "0.2.56",
        )

        maven_1.artifact(
            artifact = "core.specs.alpha1",
            group = "org.clojure1",
            version = "0.2.561",
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('maven_artifact'),
            group: fragments.string('org.clojure'),
            artifact: fragments.string('core.specs.alpha'),
            version: fragments.string('0.2.56'),
            exclusions: fragments.array(
              [
                {
                  type: 'string',
                  value: 'org.clojure:clojure',
                  isComplete: true,
                },
              ],
              true,
            ),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('maven_artifact'),
            group: fragments.string('org.clojure1'),
            artifact: fragments.string('core.specs.alpha1'),
            version: fragments.string('0.2.561'),
          },
          true,
        ),
      ]);
    });

    it('finds maven.install and maven.artifact', () => {
      const input = codeBlock`
        maven.install(
            artifacts = [
                "junit:junit:4.13.2",
                "com.google.guava:guava:31.1-jre",
            ],
            repositories = [
                "https://repo1.maven.org/maven2/"
            ]
        )

        maven.artifact(
            artifact = "core.specs.alpha",
            group = "org.clojure",
            version = "0.2.56",
        )
      `;
      const res = parse(input);
      expect(res).toEqual([
        fragments.record(
          {
            rule: fragments.string('maven_install'),
            artifacts: fragments.array(
              [
                {
                  type: 'string',
                  value: 'junit:junit:4.13.2',
                  isComplete: true,
                },
                {
                  type: 'string',
                  value: 'com.google.guava:guava:31.1-jre',
                  isComplete: true,
                },
              ],
              true,
            ),
            repositories: fragments.array(
              [
                {
                  type: 'string',
                  value: 'https://repo1.maven.org/maven2/',
                  isComplete: true,
                },
              ],
              true,
            ),
          },
          true,
        ),
        fragments.record(
          {
            rule: fragments.string('maven_artifact'),
            group: fragments.string('org.clojure'),
            artifact: fragments.string('core.specs.alpha'),
            version: fragments.string('0.2.56'),
          },
          true,
        ),
      ]);
    });
  });
});
