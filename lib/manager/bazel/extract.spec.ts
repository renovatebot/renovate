import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const workspaceFile = readFileSync(
  'lib/manager/bazel/__fixtures__/WORKSPACE1',
  'utf8'
);

const workspace2File = readFileSync(
  'lib/manager/bazel/__fixtures__/WORKSPACE2',
  'utf8'
);

const workspace3File = readFileSync(
  'lib/manager/bazel/__fixtures__/WORKSPACE3',
  'utf8'
);

const fileWithBzlExtension = readFileSync(
  'lib/manager/bazel/__fixtures__/repositories.bzl',
  'utf8'
);

describe(getName(__filename), () => {
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
      const res = extractPackageFile(workspaceFile);
      expect(res.deps).toHaveLength(14);
      expect(res.deps).toMatchSnapshot();
    });
    it('extracts github tags', () => {
      const res = extractPackageFile(workspace2File);
      expect(res.deps).toMatchSnapshot();
    });
    it('handle comments and strings', () => {
      const res = extractPackageFile(workspace3File);
      expect(res.deps).toMatchSnapshot();
    });
    it('extracts dependencies from *.bzl files', () => {
      const res = extractPackageFile(fileWithBzlExtension);
      expect(res.deps).toMatchSnapshot();
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
        `
      );
      expect(successStory.deps[0].datasource).toBe('go');
      expect(successStory.deps[0].lookupName).toBe('github.com/test/uuid-fork');

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
      expect(badStory.deps[0].skipReason).toBe('unsupported-remote');

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
      expect(gheStory.deps[0].skipReason).toBe('unsupported-remote');

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
      expect(gitlabRemote.deps[0].skipReason).toBe('unsupported-remote');
    });
  });
});
