import { codeBlock } from 'common-tags';
import { BooleanFragment, RecordFragment, StringFragment } from './fragments';
import { parse } from './parser';

describe('modules/manager/bazel-module/parser', () => {
  describe('parse', () => {
    it('returns empty string if invalid content', () => {
      const input = codeBlock`
      // This is invalid
      a + 1
      <<<<<<<
      `;
      const res = parse(input);
      expect(res).toHaveLength(0);
    });

    it('finds simple bazel_dep', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
        bazel_dep(name = "rules_bar", version = "1.0.0", dev_dependency = True)
      `;
      const res = parse(input);
      expect(res).toEqual([
        new RecordFragment(
          {
            rule: new StringFragment('bazel_dep'),
            name: new StringFragment('rules_foo'),
            version: new StringFragment('1.2.3'),
          },
          true
        ),
        new RecordFragment(
          {
            rule: new StringFragment('bazel_dep'),
            name: new StringFragment('rules_bar'),
            version: new StringFragment('1.0.0'),
            dev_dependency: new BooleanFragment(true),
          },
          true
        ),
      ]);
    });
  });
});
