import { codeBlock } from 'common-tags';
import { Ctx, parse } from './parser';
import { RecordFragment, StringFragment } from './types';

describe('modules/manager/bazel-module/parser', () => {
  describe('Ctx', () => {
    it('construct bazel_dep', () => {
      const ctx = new Ctx()
        .startRule('bazel_dep')
        .startAttribute('name')
        .setAttributeValue('rules_foo')
        .startAttribute('version')
        .setAttributeValue('1.2.3')
        .endRule();

      expect(ctx.results).toEqual([
        new RecordFragment({
          rule: new StringFragment('bazel_dep'),
          name: new StringFragment('rules_foo'),
          version: new StringFragment('1.2.3'),
        }),
      ]);
    });
  });

  describe('parse', () => {
    it('finds simple bazel_dep', () => {
      const input = codeBlock`
        bazel_dep(name = "rules_foo", version = "1.2.3")
      `;
      const res = parse(input, 'MODULE.bazel');
      expect(res).toEqual([
        new RecordFragment({
          rule: new StringFragment('bazel_dep'),
          name: new StringFragment('rules_foo'),
          version: new StringFragment('1.2.3'),
        }),
      ]);
    });
  });
});
