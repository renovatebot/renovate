import { codeBlock } from 'common-tags';
import { RecordFragment, StringFragment } from './fragments';
import { parse } from './parser';

describe('modules/manager/bazel-module/parser', () => {
  describe('parse', () => {
    it('finds simple bazel_dep', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
      `;
      const res = parse(input, 'MODULE.bazel');
      expect(res).toEqual([
        new RecordFragment(
          {
            rule: new StringFragment('bazel_dep'),
            name: new StringFragment('rules_foo'),
            version: new StringFragment('1.2.3'),
          },
          true
        ),
      ]);
    });
  });
});
