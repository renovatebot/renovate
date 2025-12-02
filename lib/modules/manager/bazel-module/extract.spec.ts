import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { BazelDatasource } from '../../datasource/bazel';
import { DockerDatasource } from '../../datasource/docker';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { MavenDatasource } from '../../datasource/maven';
import * as parser from './parser';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/bazel-module/__fixtures__'),
};

describe('modules/manager/bazel-module/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      vi.restoreAllMocks();
    });

    it('returns null if fails to parse', async () => {
      const result = await extractPackageFile(
        'blahhhhh:foo:@what\n',
        'MODULE.bazel',
      );
      expect(result).toBeNull();
    });

    it('returns null if something throws an error', async () => {
      vi.spyOn(parser, 'parse').mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      const result = await extractPackageFile('content', 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns null if file is empty', async () => {
      const result = await extractPackageFile('', 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns null if file has unrecognized declarations', async () => {
      const input = codeBlock`
        ignore_me(name = "rules_foo", version = "1.2.3")
      `;
      const result = await extractPackageFile(input, 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns bazel_dep and git_override dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")

        bazel_dep(name = "rules_bar", version = "1.0.0", dev_dependency = True)

        git_override(
            module_name = "rules_foo",
            commit = "850cb49c8649e463b80ef7984e7c744279746170",
            remote = "https://github.com/example/rules_foo.git",
        )
        `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'git-dependency',
          },
          {
            depType: 'git_override',
            depName: 'rules_foo',
            currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
            datasource: GithubTagsDatasource.id,
            packageName: 'example/rules_foo',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_bar',
            currentValue: '1.0.0',
          },
        ],
      });
    });

    it('returns bazel_dep with no version and git_override', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo")
        git_override(
            module_name = "rules_foo",
            commit = "850cb49c8649e463b80ef7984e7c744279746170",
            remote = "https://github.com/example/rules_foo.git",
        )
        `;

      const result = await extractPackageFile(input, 'MODULE.bazel');
      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            skipReason: 'git-dependency',
          },
          {
            datasource: GithubTagsDatasource.id,
            depType: 'git_override',
            depName: 'rules_foo',
            currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
            packageName: 'example/rules_foo',
          },
        ],
      });
    });

    it('returns dependencies and custom registry URLs when specified in a bazelrc', async () => {
      const packageFile = 'extract/multiple-bazelrcs/MODULE.bazel';
      const input = Fixtures.get(packageFile);

      const result = await extractPackageFile(input, packageFile);
      expect(result).toEqual({
        registryUrls: [
          'https://example.com/custom_registry.git',
          'https://github.com/bazelbuild/bazel-central-registry',
        ],
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
          },
        ],
      });
    });

    it('returns bazel_dep and archive_override dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        archive_override(
          module_name = "rules_foo",
          urls = [
            "https://example.com/archive.tar.gz",
          ],
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'file-dependency',
          },
          {
            depType: 'archive_override',
            depName: 'rules_foo',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('returns bazel_dep with no version and archive_override dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo")
        archive_override(
          module_name = "rules_foo",
          urls = [
            "https://example.com/archive.tar.gz",
          ],
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            skipReason: 'file-dependency',
          },
          {
            depType: 'archive_override',
            depName: 'rules_foo',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('returns bazel_dep and local_path_override dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        local_path_override(
          module_name = "rules_foo",
          urls = "/path/to/repo",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'local-dependency',
          },
          {
            depType: 'local_path_override',
            depName: 'rules_foo',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('returns bazel_dep with no version and local_path_override dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo")
        local_path_override(
          module_name = "rules_foo",
          urls = "/path/to/repo",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            skipReason: 'local-dependency',
          },
          {
            depType: 'local_path_override',
            depName: 'rules_foo',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('returns bazel_dep and single_version_override dependencies if a version is specified', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        single_version_override(
          module_name = "rules_foo",
          version = "1.2.5",
          registry = "https://example.com/custom_registry",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'is-pinned',
            registryUrls: ['https://example.com/custom_registry'],
          },
          {
            depType: 'single_version_override',
            depName: 'rules_foo',
            skipReason: 'ignored',
            currentValue: '1.2.5',
            registryUrls: ['https://example.com/custom_registry'],
          },
        ],
      });
    });

    it('returns bazel_dep with no version and single_version_override dependencies if a version is specified', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo")
        single_version_override(
          module_name = "rules_foo",
          version = "1.2.3",
          registry = "https://example.com/custom_registry",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            skipReason: 'is-pinned',
            registryUrls: ['https://example.com/custom_registry'],
          },
          {
            depType: 'single_version_override',
            depName: 'rules_foo',
            skipReason: 'ignored',
            currentValue: '1.2.3',
            registryUrls: ['https://example.com/custom_registry'],
          },
        ],
      });
    });

    it('returns bazel_dep dependency if single_version_override does not have a version', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        single_version_override(
          module_name = "rules_foo",
          registry = "https://example.com/custom_registry",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            registryUrls: ['https://example.com/custom_registry'],
          },
        ],
      });
    });

    it('returns bazel_dep with no version dependency if single_version_override does not have a version', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo")
        single_version_override(
          module_name = "rules_foo",
          registry = "https://example.com/custom_registry",
        )
      `;
      const result = await extractPackageFile(input, 'MODULE.bazel');
      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            skipReason: 'unspecified-version',
            registryUrls: ['https://example.com/custom_registry'],
          },
        ],
      });
    });

    it('returns maven.install and maven.artifact dependencies', async () => {
      const input = codeBlock`
        maven.artifact(
            artifact = "core.specs.alpha",
            exclusions = ["org.clojure:clojure"],
            group = "org.clojure",
            version = "0.2.56",
        )

        maven.install(
            artifacts = [
                "junit:junit:4.13.2",
                "com.google.guava:guava:31.1-jre",
            ],
            lock_file = "//:maven_install.json",
            repositories = [
                "https://repo1.maven.org/maven2/",
            ],
            version_conflict_policy = "pinned",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: MavenDatasource.id,
            versioning: 'gradle',
            depName: 'junit:junit',
            currentValue: '4.13.2',
            depType: 'maven_install',
            registryUrls: ['https://repo1.maven.org/maven2/'],
          },
          {
            datasource: MavenDatasource.id,
            versioning: 'gradle',
            depName: 'com.google.guava:guava',
            currentValue: '31.1-jre',
            depType: 'maven_install',
            registryUrls: ['https://repo1.maven.org/maven2/'],
          },
          {
            datasource: MavenDatasource.id,
            versioning: 'gradle',
            depName: 'org.clojure:core.specs.alpha',
            currentValue: '0.2.56',
            depType: 'maven_install',
            registryUrls: ['https://repo1.maven.org/maven2/'],
          },
        ],
      });
    });

    it('returns oci.pull dependencies', async () => {
      const input = codeBlock`
        oci.pull(
          name = "nginx_image",
          digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
          image = "index.docker.io/library/nginx",
          platforms = ["linux/amd64"],
          tag = "1.27.1",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: DockerDatasource.id,
            depType: 'oci_pull',
            depName: 'nginx_image',
            packageName: 'index.docker.io/library/nginx',
            currentValue: '1.27.1',
            currentDigest:
              'sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720',
            replaceString: codeBlock`
              oci.pull(
                name = "nginx_image",
                digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
                image = "index.docker.io/library/nginx",
                platforms = ["linux/amd64"],
                tag = "1.27.1",
              )
            `,
          },
        ],
      });
    });

    it('returns oci.pull dependencies without tags', async () => {
      const input = codeBlock`
        oci.pull(
          name = "nginx_image",
          digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
          image = "index.docker.io/library/nginx",
          platforms = ["linux/amd64"],
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: DockerDatasource.id,
            depType: 'oci_pull',
            depName: 'nginx_image',
            packageName: 'index.docker.io/library/nginx',
            currentDigest:
              'sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720',
            replaceString: codeBlock`
              oci.pull(
                name = "nginx_image",
                digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
                image = "index.docker.io/library/nginx",
                platforms = ["linux/amd64"],
              )
            `,
          },
        ],
      });
    });

    it('returns maven.install and bazel_dep dependencies together', async () => {
      const input = codeBlock`
        bazel_dep(name = "bazel_jar_jar", version = "0.1.0")

        maven = use_extension("@rules_jvm_external//:extensions.bzl", "maven")

        maven.install(
            artifacts = [
                "junit:junit:4.13.2",
                "com.google.guava:guava:31.1-jre",
            ],
            lock_file = "//:maven_install.json",
            repositories = [
                "https://repo1.maven.org/maven2/",
            ],
            version_conflict_policy = "pinned",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'bazel_jar_jar',
            currentValue: '0.1.0',
          },
          {
            datasource: MavenDatasource.id,
            versioning: 'gradle',
            depName: 'junit:junit',
            currentValue: '4.13.2',
            depType: 'maven_install',
            registryUrls: ['https://repo1.maven.org/maven2/'],
          },
          {
            datasource: MavenDatasource.id,
            versioning: 'gradle',
            depName: 'com.google.guava:guava',
            currentValue: '31.1-jre',
            depType: 'maven_install',
            registryUrls: ['https://repo1.maven.org/maven2/'],
          },
        ],
      });
    });

    it('returns git_repository dependencies with digest', async () => {
      const input = codeBlock`
        git_repository(
            name = "rules_foo",
            commit = "850cb49c8649e463b80ef7984e7c744279746170",
            remote = "https://github.com/example/rules_foo.git"
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            depType: 'git_repository',
            depName: 'rules_foo',
            currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
            datasource: GithubTagsDatasource.id,
            packageName: 'example/rules_foo',
          },
        ],
      });
    });

    it('returns git_repository dependencies with tag', async () => {
      const input = codeBlock`
        git_repository(
            name = "rules_foo",
            tag = "1.2.3",
            remote = "https://github.com/example/rules_foo.git"
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            depType: 'git_repository',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            datasource: GithubTagsDatasource.id,
            packageName: 'example/rules_foo',
          },
        ],
      });
    });

    it('returns new_git_repository dependencies', async () => {
      const input = codeBlock`
        new_git_repository(
            name = "rules_foo",
            commit = "850cb49c8649e463b80ef7984e7c744279746170",
            remote = "https://github.com/example/rules_foo.git",
            tag = "1.2.3"
        )
        `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            depType: 'new_git_repository',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
            datasource: GithubTagsDatasource.id,
            packageName: 'example/rules_foo',
          },
        ],
      });
    });

    it('handles a real-world MODULE.bazel file (rules_sh)', async () => {
      const input = codeBlock`
        module(
            name = "rules_sh",
            version = "0.5.0",
            compatibility_level = 0,
        )
        bazel_dep(name = "bazel_skylib", version = "1.2.1")
        bazel_dep(name = "platforms", version = "0.0.8")
        bazel_dep(name = "stardoc", version = "0.6.2", dev_dependency = True, repo_name = "io_bazel_stardoc")
        sh_configure = use_extension("//bzlmod:extensions.bzl", "sh_configure")
        use_repo(sh_configure, "local_posix_config", "rules_sh_shim_exe")
        register_toolchains("@local_posix_config//...")
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'bazel_skylib',
            currentValue: '1.2.1',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'platforms',
            currentValue: '0.0.8',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'stardoc',
            currentValue: '0.6.2',
          },
        ],
      });
    });

    it('handles every method available in MODULE.bazel files', async () => {
      const input = codeBlock`
        module(
            name = "module_name",
            version = "1.2.3",
            compatibility_level = 0,
            repo_name = "io_bazel_module_name",
            bazel_compatibility = ["<=6.0.0", ">=8.2.0"],
        )
        bazel_dep(name = "bazel_skylib", version = "1.2.1")
        bazel_dep(name = "platforms", version = "0.0.8")
        bazel_dep(name = "rules_img", version = "0.1.5")
        bazel_dep(name = "stardoc", version = "0.6.2", dev_dependency = True, repo_name = "io_bazel_stardoc")
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        pull(
            name = "ubuntu",
            digest = "sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9",
            registry = "index.docker.io",
            repository = "library/ubuntu",
            tag = "24.04",
        )
        multiple_version_override(
            module_name = "overriden_module_a",
            versions = ["1.2.3", "1.2.4"],
            registry = "https://example.com/custom_registry",
        )
        git_override(
            module_name = "overriden_module_c",
            commit = "850cb49c8649e463b80ef7984e7c744279746170",
            remote = "https://github.com/example/overriden_module_b.git",
        )
        archive_override(
            module_name = "overriden_module_d",
            urls = [
                "https://example.com/archive.tar.gz",
            ],
        )
        include("//:extra.MODULE.bazel")
        sh_configure = use_extension("//bzlmod:extensions.bzl", "sh_configure")
        use_repo(sh_configure, "local_posix_config", "rules_sh_shim_exe")
        override_repo(
            sh_configure,
            com_github_foo_bar = "overriden_module_a",
        )
        register_execution_platforms(
            "@overriden_module_a//:some_execution_platform",
            dev_dependency = True,
        )
        register_toolchains(
            "@overriden_module_a//:some_toolchain",
            dev_dependency = True,
        )
        single_version_override(
            module_name = "overriden_module_c",
            version = "1.2.5",
            registry = "https://example.com/custom_registry",
            patch_cmds = [],
            patch_strip = 8,
        )
        my_repo_rule = use_repo_rule("@my_repo//:my_repo.bzl", "my_repo_rule")
        my_repo_rule(
            name = "my_custom_repo",
            url = "https://example.com/my_custom_repo.tar.gz",
            sha256 = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'bazel_skylib',
            currentValue: '1.2.1',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'platforms',
            currentValue: '0.0.8',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_img',
            currentValue: '0.1.5',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'stardoc',
            currentValue: '0.6.2',
          },
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'ubuntu',
            packageName: 'index.docker.io/library/ubuntu',
            currentValue: '24.04',
            currentDigest:
              'sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9',
            registryUrls: ['https://index.docker.io'],
            replaceString: codeBlock`
              pull(
                  name = "ubuntu",
                  digest = "sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9",
                  registry = "index.docker.io",
                  repository = "library/ubuntu",
                  tag = "24.04",
              )
            `,
          },
        ],
      });
    });

    it('returns rules_img pull dependencies', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_img", version = "0.1.0")
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        pull(
            name = "ubuntu",
            digest = "sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9",
            registry = "index.docker.io",
            repository = "library/ubuntu",
            tag = "24.04",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_img',
            currentValue: '0.1.0',
          },
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'ubuntu',
            packageName: 'index.docker.io/library/ubuntu',
            currentValue: '24.04',
            currentDigest:
              'sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9',
            registryUrls: ['https://index.docker.io'],
            replaceString: codeBlock`
              pull(
                  name = "ubuntu",
                  digest = "sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9",
                  registry = "index.docker.io",
                  repository = "library/ubuntu",
                  tag = "24.04",
              )
            `,
          },
        ],
      });
    });

    it('returns rules_img pull dependencies with custom registry', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        pull(
            name = "my_image",
            registry = "my.registry.com",
            repository = "myorg/myimage",
            tag = "v1.2.3",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'my_image',
            packageName: 'my.registry.com/myorg/myimage',
            currentValue: 'v1.2.3',
            registryUrls: ['https://my.registry.com'],
            replaceString: codeBlock`
              pull(
                  name = "my_image",
                  registry = "my.registry.com",
                  repository = "myorg/myimage",
                  tag = "v1.2.3",
              )
            `,
          },
        ],
      });
    });

    it('returns rules_img pull dependencies with multiple pulls', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
        pull(
            name = "nginx",
            repository = "library/nginx",
            tag = "1.27.1",
            digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'ubuntu',
            packageName: 'library/ubuntu',
            currentValue: '24.04',
            replaceString: codeBlock`
              pull(
                  name = "ubuntu",
                  repository = "library/ubuntu",
                  tag = "24.04",
              )
            `,
          },
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'nginx',
            packageName: 'library/nginx',
            currentValue: '1.27.1',
            currentDigest:
              'sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720',
            replaceString: codeBlock`
              pull(
                  name = "nginx",
                  repository = "library/nginx",
                  tag = "1.27.1",
                  digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
              )
            `,
          },
        ],
      });
    });

    it('ignores rules_img pull without required fields', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        # Missing repository
        pull(
            name = "missing_repo",
            tag = "1.0.0",
        )
        # Missing name
        pull(
            repository = "library/ubuntu",
            tag = "24.04",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toBeNull();
    });

    it('handles rules_img with renamed variable', async () => {
      const input = codeBlock`
        my_pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
        my_pull(
            name = "ubuntu",
            repository = "library/ubuntu",
            tag = "24.04",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: DockerDatasource.id,
            depType: 'rules_img_pull',
            depName: 'ubuntu',
            packageName: 'library/ubuntu',
            currentValue: '24.04',
            replaceString: codeBlock`
              my_pull(
                  name = "ubuntu",
                  repository = "library/ubuntu",
                  tag = "24.04",
              )
            `,
          },
        ],
      });
    });

    it('ignores non-rules_img repo rules', async () => {
      const input = codeBlock`
        bazel_dep(name = "some_rules", version = "0.1.0")

        other_rule = use_repo_rule("@some_rules//some:rule.bzl", "other")

        other_rule(
            name = "test",
            value = "something",
        )
      `;

      const result = await extractPackageFile(input, 'MODULE.bazel');

      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'some_rules',
            currentValue: '0.1.0',
          },
        ],
      });
    });
  });
});
