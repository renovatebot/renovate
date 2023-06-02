import { codeBlock } from 'common-tags';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as parser from './parser';
import { extractPackageFile } from '.';

describe('modules/manager/bazel-module/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null if fails to parse', () => {
      const result = extractPackageFile('blahhhhh:foo:@what\n', 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns null if something throws an error', () => {
      jest.spyOn(parser, 'parse').mockImplementationOnce((input) => {
        throw new Error('Test error');
      });
      const result = extractPackageFile('content', 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns null if file is empty', () => {
      const result = extractPackageFile('', 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns null if file has not recognized declarations', () => {
      const input = codeBlock`
        ignore_me(name = "rules_foo", version = "1.2.3")
      `;
      const result = extractPackageFile(input, 'MODULE.bazel');
      expect(result).toBeNull();
    });

    it('returns dependencies', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        bazel_dep(name = "rules_bar", version = "1.0.0", dev_dependency = True)
      `;
      const result = extractPackageFile(input, 'MODULE.bazel');
      expect(result).toEqual({
        deps: [
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
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

    it('returns bazel_dep and git_override dependencies', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        bazel_dep(name = "rules_bar", version = "1.0.0", dev_dependency = True)
        git_override(
          module_name = "rules_foo",
          remote = "https://github.com/example/rules_foo.git",
          commit = "850cb49c8649e463b80ef7984e7c744279746170",
        )
      `;
      const result = extractPackageFile(input, 'MODULE.bazel');
      if (!result) {
        throw new Error('Expected a result.');
      }
      expect(result.deps).toHaveLength(3);
      expect(result.deps).toEqual(
        expect.arrayContaining([
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_bar',
            currentValue: '1.0.0',
          },
          {
            datasource: BazelDatasource.id,
            depType: 'bazel_dep',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'git-dependency',
          },
          {
            datasource: GithubTagsDatasource.id,
            depType: 'git_override',
            depName: 'rules_foo',
            currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
            packageName: 'example/rules_foo',
          },
        ])
      );
    });

    it('returns bazel_dep and archive_override dependencies', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        archive_override(
          module_name = "rules_foo",
          urls = [
            "https://example.com/archive.tar.gz",
          ],
        )
      `;
      const result = extractPackageFile(input, 'MODULE.bazel');
      if (!result) {
        throw new Error('Expected a result.');
      }
      expect(result.deps).toHaveLength(2);
      expect(result.deps).toEqual(
        expect.arrayContaining([
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
        ])
      );
    });

    it('returns bazel_dep and local_path_override dependencies', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        local_path_override(
          module_name = "rules_foo",
          urls = "/path/to/repo",
        )
      `;
      const result = extractPackageFile(input, 'MODULE.bazel');
      if (!result) {
        throw new Error('Expected a result.');
      }
      expect(result.deps).toHaveLength(2);
      expect(result.deps).toEqual(
        expect.arrayContaining([
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
        ])
      );
    });
  });
});
