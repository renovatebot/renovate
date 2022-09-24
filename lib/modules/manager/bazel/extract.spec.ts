import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile as extract } from '.';

const extractPackageFile = (content: string) => extract(content, 'WORKSPACE');

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

    it('extracts multiple types of dependencies', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE1'));
      expect(res?.deps).toHaveLength(18);
      expect(res?.deps).toMatchSnapshot();
    });

    it('extracts github tags', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE2'));
      expect(res?.deps).toMatchSnapshot([
        { packageName: 'lmirosevic/GBDeviceInfo' },
        { packageName: 'nelhage/rules_boost' },
        { packageName: 'lmirosevic/GBDeviceInfo' },
        { packageName: 'nelhage/rules_boost' },
        { packageName: 'bazelbuild/rules_go' },
      ]);
    });

    it('handle comments and strings', () => {
      const res = extractPackageFile(Fixtures.get('WORKSPACE3'));
      expect(res?.deps).toMatchSnapshot([
        { packageName: 'nelhage/rules_boost' },
      ]);
    });

    it('extracts dependencies from *.bzl files', () => {
      const res = extractPackageFile(Fixtures.get('repositories.bzl'));
      expect(res?.deps).toMatchSnapshot([
        {
          currentDigest: '0356bef3fbbabec5f0e196ecfacdeb6db62d48c0',
          packageName: 'google/subpar',
        },
        {
          currentValue: '0.6.0',
          packageName: 'bazelbuild/bazel-skylib',
        },
        {
          currentValue: '0.5.0',
          packageName: 'bazelbuild/stardoc',
        },
      ]);
    });

    it('extracts dependencies for container_pull deptype', () => {
      const res = extractPackageFile(
        `
        container_pull(
          name="hasura",
          registry="index.docker.io",
          repository="hasura/graphql-engine",
          # v1.0.0-alpha31.cli-migrations 11/28
          digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
          tag="v1.0.0-alpha31.cli-migrations"
        )`
      );
      expect(res?.deps).toMatchSnapshot([
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

    it('check remote option in go_repository', () => {
      const successStory = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://github.com/test/uuid-fork",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `
      );
      expect(successStory?.deps[0].datasource).toBe('go');
      expect(successStory?.deps[0].packageName).toBe(
        'github.com/test/uuid-fork'
      );

      const badStory = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://github.com/test/uuid.git#branch",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `
      );
      expect(badStory?.deps[0].skipReason).toBe('unsupported-remote');

      const gheStory = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://github.mycompany.com/test/uuid",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `
      );
      expect(gheStory?.deps[0].skipReason).toBe('unsupported-remote');

      const gitlabRemote = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://gitlab.com/test/uuid",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `
      );
      expect(gitlabRemote?.deps[0].skipReason).toBe('unsupported-remote');
    });

    it('sequential http_archive', () => {
      // Sequential http_archive
      // See https://github.com/aspect-build/rules_swc/commit/d4989f9dfed781dc0226421fb9373b45052e7bc8
      const res = extractPackageFile(
        `
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
        `
      );

      expect(res?.deps).toHaveLength(2);
      expect(res?.deps).toMatchSnapshot();
    });
  });
});
