import { BazelDatasource } from '../../datasource/bazel';
import { toPackageDependency } from './bazel-dep';
import * as fragments from './fragments';

describe('modules/manager/bazel-module/bazel-dep', () => {
  describe('toPackageDependency()', () => {
    it('transforms a record fragment', () => {
      const record = fragments.record({
        rule: fragments.string('bazel_dep'),
        name: fragments.string('rules_foo'),
        version: fragments.string('1.2.3'),
        dev_dependency: fragments.boolean(true),
      });
      const result = toPackageDependency(record);
      expect(result).toEqual({
        datasource: BazelDatasource.id,
        depType: 'bazel_dep',
        depName: 'rules_foo',
        currentValue: '1.2.3',
      });
    });

    it('returns null if invalid', () => {
      const frag = fragments.record();
      const result = toPackageDependency(frag);
      expect(result).toBeNull();
    });
  });
});
