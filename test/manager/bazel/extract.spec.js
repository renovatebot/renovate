const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/bazel/extract');

const workspaceFile = fs.readFileSync(
  'test/_fixtures/bazel/WORKSPACE1',
  'utf8'
);

describe('lib/manager/bazel/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n', config);
      expect(res).toBe(null);
    });
    it('returns empty if cannot parse dependency', () => {
      const res = extractPackageFile('git_repository(\n  nothing\n)\n', config);
      expect(res).toBe(null);
    });
    it('extracts multiple types of dependencies', () => {
      const res = extractPackageFile(workspaceFile, config);
      expect(res.deps).toMatchSnapshot();
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
        `,
        config
      );
      expect(successStory.deps[0].purl).toBe(
        'pkg:go/github.com/test/uuid-fork'
      );

      const badStory = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://github.com/test/uuid.git#branch",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `,
        config
      );
      expect(badStory.deps[0].skipReason).toBe('unsupported-remote');

      const gheStory = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://github.mycompany.com/test/uuid",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `,
        config
      );
      expect(gheStory.deps[0].skipReason).toBe('unsupported-remote');

      const gitlabRemote = extractPackageFile(
        `
go_repository(
  name = "test_repository",
  importpath = "github.com/google/uuid",
  remote = "https://gitlab.com/test/uuid",
  commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
        `,
        config
      );
      expect(gitlabRemote.deps[0].skipReason).toBe('unsupported-remote');
    });
  });
});
