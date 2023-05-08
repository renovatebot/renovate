import { codeBlock } from 'common-tags';
import { BazelDatasource } from '../../datasource/bazel';
import { extractPackageFile } from '.';

describe('modules/manager/bazel-module/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null if fails to parse', () => {
      const result = extractPackageFile('blahhhhh:foo:@what\n', 'MODULE.bazel');
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
  });
});
