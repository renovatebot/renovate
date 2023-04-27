import { BazelDatasource } from '../../../datasource/bazel';
import { BooleanFragment, RecordFragment, StringFragment } from '../fragments';
import { BazelDepRecord, BazelDepRecordToPackageDependency } from './bazel-dep';

describe('modules/manager/bazel-module/rules/bazel-dep', () => {
  describe('BazelDepFragment', () => {
    it('parses record fragment without dev_dependency', () => {
      const record = new RecordFragment({
        rule: new StringFragment('bazel_dep'),
        name: new StringFragment('rules_foo'),
        version: new StringFragment('1.2.3'),
      });
      expect(() => BazelDepRecord.parse(record)).not.toThrow();
    });

    it('parses record fragment with dev_dependency', () => {
      const record = new RecordFragment({
        rule: new StringFragment('bazel_dep'),
        name: new StringFragment('rules_foo'),
        version: new StringFragment('1.2.3'),
        dev_dependency: new BooleanFragment(true),
      });
      expect(() => BazelDepRecord.parse(record)).not.toThrow();
    });
  });

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
