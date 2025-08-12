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

    it('returns rules_img pull dependencies', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")

        pull(
          name = "ubuntu",
          digest = "sha256:1e622c5f073b4f6bfad6632f2616c7f59ef256e96fe78bf6a595d1dc4376ac02",
          registry = "index.docker.io",
          repository = "library/ubuntu",
          tag = "24.04",
        )
      `;
      const res = await extractPackageFile(input, 'MODULE.bazel');

      expect(res).toEqual({
        deps: [
          {
            datasource: 'docker',
            depType: 'rules_img_pull',
            depName: 'ubuntu',
            packageName: 'index.docker.io/library/ubuntu',
            currentValue: '24.04',
            currentDigest:
              'sha256:1e622c5f073b4f6bfad6632f2616c7f59ef256e96fe78bf6a595d1dc4376ac02',
            replaceString: expect.stringContaining('pull('),
          },
        ],
      });
    });

    it('returns rules_img pull dependencies without tag', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")

        pull(
          name = "distroless_cc",
          digest = "sha256:d1b8e4c52be1111aa108e959ef2a822299bb70fd1819dd250871a2601ca1e4b6",
          registry = "gcr.io",
          repository = "distroless/cc-debian12",
        )
      `;
      const res = await extractPackageFile(input, 'MODULE.bazel');

      expect(res).toEqual({
        deps: [
          {
            datasource: 'docker',
            depType: 'rules_img_pull',
            depName: 'distroless_cc',
            packageName: 'gcr.io/distroless/cc-debian12',
            currentDigest:
              'sha256:d1b8e4c52be1111aa108e959ef2a822299bb70fd1819dd250871a2601ca1e4b6',
            replaceString: expect.stringContaining('pull('),
          },
        ],
      });
    });

    it('ignores non-rules_img use_repo_rule calls', async () => {
      const input = codeBlock`
        other_rule = use_repo_rule("@some_other//path:rule.bzl", "other_rule")

        pull(
          name = "ubuntu",
          digest = "sha256:1e622c5f073b4f6bfad6632f2616c7f59ef256e96fe78bf6a595d1dc4376ac02",
          registry = "index.docker.io",
          repository = "library/ubuntu",
          tag = "24.04",
        )
      `;
      const res = await extractPackageFile(input, 'MODULE.bazel');

      expect(res).toBeNull();
    });

    it('ignores non-rules_img use_repo_rule calls that use the name pull', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@some_other//path:rule.bzl", "pull")

        pull(
          name = "test",
          value = "ignored",
        )
      `;
      const res = await extractPackageFile(input, 'MODULE.bazel');

      expect(res).toBeNull();
    });

    it('handles multiple rules_img pulls', async () => {
      const input = codeBlock`
        pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")

        pull(
          name = "ubuntu",
          digest = "sha256:1e622c5f073b4f6bfad6632f2616c7f59ef256e96fe78bf6a595d1dc4376ac02",
          registry = "index.docker.io",
          repository = "library/ubuntu",
          tag = "24.04",
        )

        pull(
          name = "cuda",
          digest = "sha256:f353ffca86e0cd93ab2470fe274ecf766519c24c37ed58cc2f91d915f7ebe53c",
          registry = "index.docker.io",
          repository = "nvidia/cuda",
          tag = "12.8.1-cudnn-devel-ubuntu20.04",
        )
      `;
      const res = await extractPackageFile(input, 'MODULE.bazel');

      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0].depName).toBe('ubuntu');
      expect(res?.deps[1].depName).toBe('cuda');
    });
  });
});
