import { codeBlock } from 'common-tags';
import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as parser from './parser';
import { extractPackageFile } from '.';

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/bazel-module/__fixtures__'),
};

describe('modules/manager/bazel-module/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      jest.restoreAllMocks();
    });

    it('returns null if fails to parse', async () => {
      const result = await extractPackageFile(
        'blahhhhh:foo:@what\n',
        'MODULE.bazel',
      );
      expect(result).toBeNull();
    });

    it('returns null if something throws an error', async () => {
      jest.spyOn(parser, 'parse').mockImplementationOnce(() => {
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
        ]),
      );
    });

    it('returns dependencies and custom registry URLs when specified in a bazelrc', async () => {
      const packageFile = 'extract/multiple-bazelrcs/MODULE.bazel';
      const input = Fixtures.get(packageFile);
      const result = await extractPackageFile(input, packageFile);
      if (!result) {
        throw new Error('Expected a result.');
      }
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
        ]),
      );
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
        ]),
      );
    });

    it('returns bazel_dep and single_version_override dependencies if a version is specified', async () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        single_version_override(
          module_name = "rules_foo",
          version = "1.2.3",
          registry = "https://example.com/custom_registry",
        )
      `;
      const result = await extractPackageFile(input, 'MODULE.bazel');
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
            skipReason: 'is-pinned',
            registryUrls: ['https://example.com/custom_registry'],
          },
          {
            depType: 'single_version_override',
            depName: 'rules_foo',
            currentValue: '1.2.3',
            skipReason: 'ignored',
            registryUrls: ['https://example.com/custom_registry'],
          },
        ]),
      );
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
      if (!result) {
        throw new Error('Expected a result.');
      }
      expect(result.deps).toEqual([
        {
          datasource: BazelDatasource.id,
          depType: 'bazel_dep',
          depName: 'rules_foo',
          currentValue: '1.2.3',
          registryUrls: ['https://example.com/custom_registry'],
        },
      ]);
    });
  });
});
