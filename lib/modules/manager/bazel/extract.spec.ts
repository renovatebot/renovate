import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile as _extractPackageFile } from './index.ts';

function extractPackageFile(content: string) {
  return _extractPackageFile(content, 'WORKSPACE');
}

describe('modules/manager/bazel/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns empty if cannot parse dependency', () => {
      const res = extractPackageFile('git_repository(\n  nothing\n)\n');
      expect(res).toBeNull();
    });

    it('returns empty for incomplete dependency', () => {
      const res = extractPackageFile('git_repository(\n foo = "bar" \n)');
      expect(res).toBeNull();
    });

    it('extracts multiple types of dependencies', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE1'));
      expect(res).toEqual({
        deps: [
          {
            datasource: 'go',
            depType: 'go_repository',
            depName: 'com_github_bitly_go-nsq',
            packageName: 'github.com/bitly/go-nsq',
            currentValue: 'v1.0.5',
            managerData: { idx: 0 },
          },
          {
            datasource: 'go',
            depType: 'go_repository',
            depName: 'com_github_google_uuid',
            packageName: 'github.com/google/uuid',
            currentDigest: 'dec09d789f3dba190787f8b4454c7d3c936fed9e',
            digestOneAndOnly: true,
            managerData: { idx: 1 },
          },
          {
            datasource: 'github-releases',
            depType: 'git_repository',
            depName: 'build_bazel_rules_nodejs',
            packageName: 'bazelbuild/rules_nodejs',
            currentValue: '0.3.1',
            managerData: { idx: 2 },
          },
          {
            datasource: 'github-releases',
            depType: 'new_git_repository',
            depName: 'build_bazel_rules_typescript',
            packageName: 'bazelbuild/rules_typescript',
            currentValue: '0.6.1',
            managerData: { idx: 3 },
          },
          {
            datasource: 'github-tags',
            depType: 'git_repository',
            depName: 'com_github_bazelbuild_buildtools',
            packageName: 'bazelbuild/buildtools',
            currentDigest: 'b3b620e8bcff18ed3378cd3f35ebeb7016d71f71',
            managerData: { idx: 4 },
          },
          {
            datasource: 'github-tags',
            depType: 'http_archive',
            depName: 'bazel_toolchains',
            packageName: 'bazelbuild/bazel-toolchains',
            currentDigest: 'd665ccfa3e9c90fa789671bf4ef5f7c19c5715c4',
            managerData: { idx: 5 },
          },
          {
            datasource: 'github-releases',
            depType: 'http_archive',
            depName: 'io_bazel_rules_go',
            packageName: 'bazelbuild/rules_go',
            currentValue: 'v0.29.0',
            managerData: { idx: 6 },
          },
          {
            datasource: 'go',
            depType: 'go_repository',
            depName: 'com_github_pkg_errors',
            packageName: 'github.com/pkg/errors',
            currentDigest: '816c9085562cd7ee03e7f8188a1cfd942858cded',
            digestOneAndOnly: true,
            managerData: { idx: 7 },
          },
          {
            datasource: 'docker',
            versioning: 'docker',
            depType: 'container_pull',
            depName: 'py3_image_base',
            packageName: 'distroless/python3-debian10',
            currentValue: 'latest',
            currentDigest:
              'sha256:d5a717649fd93ea5b9c430d7f84e4c37ba219eb53bd73ed1d4a5a98e9edd84a7',
            registryUrls: ['gcr.io'],
            replaceString: codeBlock`
              container_pull(
                  name = "py3_image_base",
                  digest = "sha256:d5a717649fd93ea5b9c430d7f84e4c37ba219eb53bd73ed1d4a5a98e9edd84a7",
                  registry = "gcr.io",
                  repository = "distroless/python3-debian10",
                  tag = "latest",
              )`,
            managerData: { idx: 8 },
          },
          {
            datasource: 'github-tags',
            depType: 'http_file',
            depName: 'distroless',
            packageName: 'GoogleContainerTools/distroless',
            currentDigest: '446923c3756ceeaa75888f52fcbdd48bb314fbf8',
            managerData: { idx: 9 },
          },
        ],
      });
    });

    it('extracts github tags', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE2'));
      expect(res?.deps).toMatchObject([
        { packageName: 'lmirosevic/GBDeviceInfo' },
        { packageName: 'nelhage/rules_boost' },
        { packageName: 'lmirosevic/GBDeviceInfo' },
        { packageName: 'nelhage/rules_boost' },
        { packageName: 'bazelbuild/rules_go' },
      ]);
    });

    it('handle comments and strings', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE3'));
      expect(res?.deps).toMatchObject([{ packageName: 'nelhage/rules_boost' }]);
    });

    it('extracts dependencies from *.bzl files', () => {
      const res = extractPackageFile(Fixtures.get('repositories.bzl'));
      expect(res).toEqual({
        deps: [
          {
            datasource: 'github-tags',
            depType: 'http_archive',
            depName: 'subpar',
            packageName: 'google/subpar',
            currentDigest: '0356bef3fbbabec5f0e196ecfacdeb6db62d48c0',
            managerData: { idx: 2 },
          },
          {
            datasource: 'github-tags',
            depType: 'http_archive',
            depName: 'bazel_skylib',
            packageName: 'bazelbuild/bazel-skylib',
            currentValue: '0.6.0',
            managerData: { idx: 3 },
          },
          {
            datasource: 'github-releases',
            depType: 'http_archive',
            depName: 'io_bazel_stardoc',
            packageName: 'bazelbuild/stardoc',
            currentValue: '0.5.0',
            managerData: { idx: 4 },
          },
        ],
      });
    });

    it('extracts dependencies for container_pull deptype', () => {
      const res = extractPackageFile(
        codeBlock`
          container_pull(
            name="hasura",
            registry="index.docker.io",
            repository="hasura/graphql-engine",
            # v1.0.0-alpha31.cli-migrations 11/28
            digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
            tag="v1.0.0-alpha31.cli-migrations"
          )
        `,
      );
      expect(res?.deps).toMatchObject([
        {
          currentDigest:
            'sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548',
          currentValue: 'v1.0.0-alpha31.cli-migrations',
          depType: 'container_pull',
          packageName: 'hasura/graphql-engine',
          registryUrls: ['index.docker.io'],
        },
      ]);
    });

    it('extracts dependencies for oci_pull deptype', () => {
      const res = extractPackageFile(
        codeBlock`
          oci_pull(
            name="hasura",
            image="index.docker.io/hasura/graphql-engine",
            # v1.0.0-alpha31.cli-migrations 11/28
            digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
            tag="v1.0.0-alpha31.cli-migrations"
          )
        `,
      );
      expect(res?.deps).toMatchObject([
        {
          currentDigest:
            'sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548',
          currentValue: 'v1.0.0-alpha31.cli-migrations',
          depType: 'oci_pull',
          packageName: 'index.docker.io/hasura/graphql-engine',
        },
      ]);
    });

    it('check remote option in go_repository', () => {
      const successStory = extractPackageFile(
        codeBlock`
          go_repository(
            name = "test_repository",
            importpath = "github.com/google/uuid",
            remote = "https://github.com/test/uuid-fork",
            commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
          )
        `,
      );
      expect(successStory?.deps[0].datasource).toBe('go');
      expect(successStory?.deps[0].packageName).toBe(
        'github.com/test/uuid-fork',
      );

      const badStory = extractPackageFile(
        codeBlock`
          go_repository(
            name = "test_repository",
            importpath = "github.com/google/uuid",
            remote = "https://github.com/test/uuid.git#branch",
            commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
          )
        `,
      );
      expect(badStory?.deps[0].skipReason).toBe('unsupported-remote');

      const gheStory = extractPackageFile(
        codeBlock`
          go_repository(
            name = "test_repository",
            importpath = "github.com/google/uuid",
            remote = "https://github.mycompany.com/test/uuid",
            commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
          )
        `,
      );
      expect(gheStory?.deps[0].skipReason).toBe('unsupported-remote');

      const gitlabRemote = extractPackageFile(
        codeBlock`
          go_repository(
            name = "test_repository",
            importpath = "github.com/google/uuid",
            remote = "https://gitlab.com/test/uuid",
            commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
          )
        `,
      );
      expect(gitlabRemote?.deps[0].skipReason).toBe('unsupported-remote');
    });

    it('sequential http_archive', () => {
      // Sequential http_archive
      // See https://github.com/aspect-build/rules_swc/commit/d4989f9dfed781dc0226421fb9373b45052e7bc8
      const res = extractPackageFile(
        codeBlock`
          http_archive(
            name = "aspect_rules_js",
            sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
            strip_prefix = "rules_js-1.1.2",
            url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
          )

          http_archive(
              name = "rules_nodejs",
              sha256 = "5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064",
              urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"],
          )
        `,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: 'v1.1.2',
          datasource: 'github-tags',
          depName: 'aspect_rules_js',
          packageName: 'aspect-build/rules_js',
        },
        {
          currentValue: '5.5.3',
          datasource: 'github-releases',
          depName: 'rules_nodejs',
          packageName: 'bazelbuild/rules_nodejs',
        },
      ]);
    });

    it('http_archive with GitLab url', () => {
      // Sequential http_archive
      // See https://github.com/aspect-build/rules_swc/commit/d4989f9dfed781dc0226421fb9373b45052e7bc8
      const res = extractPackageFile(
        codeBlock`
          http_archive(
            name = "eigen3",
            url = "https://gitlab.com/libeigen/eigen/-/archive/3.3.5/eigen-3.3.5.zip",
            strip_prefix = "eigen-3.3.5",
            sha256 = "0e7aeece6c8874146c2a4addc437eebdf1ec4026680270f00e76705c8186f0b5",
            build_file = "@//third_party:eigen3.BUILD",
          )

          http_archive(
            name = "eigen",
            build_file = "//third_party:eigen.BUILD",
            sha256 = "d76992f1972e4ff270221c7ee8125610a8e02bb46708a7295ee646e99287083b",  # SHARED_EIGEN_SHA
            strip_prefix = "eigen-90ee821c563fa20db4d64d6991ddca256d5c52f2",
            urls = [
                "https://storage.googleapis.com/mirror.tensorflow.org/gitlab.com/libeigen/eigen/-/archive/90ee821c563fa20db4d64d6991ddca256d5c52f2/eigen-90ee821c563fa20db4d64d6991ddca256d5c52f2.tar.gz",
                "https://gitlab.com/foo/bar",
                "https://gitlab.com/libeigen/eigen/-/archive/90ee821c563fa20db4d64d6991ddca256d5c52f2/eigen-90ee821c563fa20db4d64d6991ddca256d5c52f2.tar.gz",
            ],
          )
        `,
      );

      expect(res?.deps).toHaveLength(2);
      expect(res?.deps).toMatchObject([
        {
          currentValue: '3.3.5',
          datasource: 'gitlab-releases',
          depName: 'eigen3',
          depType: 'http_archive',
          packageName: 'libeigen/eigen',
        },
        {
          currentDigest: '90ee821c563fa20db4d64d6991ddca256d5c52f2',
          datasource: 'gitlab-tags',
          depName: 'eigen',
          depType: 'http_archive',
          packageName: 'libeigen/eigen',
        },
      ]);
    });
  });
});
