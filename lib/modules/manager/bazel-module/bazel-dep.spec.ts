import { BazelDatasource } from '../../datasource/bazel';
import { BazelDepRecordToPackageDependency } from './bazel-dep';
import { BooleanFragment, RecordFragment, StringFragment } from './fragments';

describe('modules/manager/bazel-module/bazel-dep', () => {
  describe('BazelDepRecordToPackageDependency', () => {
    it('transforms a record fragment', () => {
      const record = new RecordFragment({
        rule: new StringFragment('bazel_dep'),
        name: new StringFragment('rules_foo'),
        version: new StringFragment('1.2.3'),
        dev_dependency: new BooleanFragment(true),
      });
      const result = BazelDepRecordToPackageDependency.parse(record);
      expect(result).toEqual({
        datasource: BazelDatasource.id,
        depType: 'bazel_dep',
        depName: 'rules_foo',
        currentValue: '1.2.3',
      });
    });
  });
});
