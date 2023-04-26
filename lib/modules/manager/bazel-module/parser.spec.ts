import { codeBlock } from 'common-tags';
import { Ctx, parse } from './parser';
import { ArrayFragment, RecordFragment, StringFragment } from './types';

describe('modules/manager/bazel-module/parser', () => {
  describe('Ctx', () => {
    it('construct bazel_dep', () => {
      const ctx = new Ctx()
        .startRule('bazel_dep')
        .startAttribute('name')
        .addString('rules_foo')
        .startAttribute('version')
        .addString('1.2.3')
        .endRule();

      expect(ctx.results).toEqual([
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

    it('construct a rule with array arg', () => {
      const ctx = new Ctx()
        .startRule('foo_library')
        .startAttribute('name')
        .addString('my_library')
        .startAttribute('srcs')
        .startArray()
        .addArrayItem('first')
        .addArrayItem('second')
        .endArray()
        .endRule();

      expect(ctx.results).toEqual([
        new RecordFragment(
          {
            rule: new StringFragment('foo_library'),
            name: new StringFragment('my_library'),
            srcs: new ArrayFragment(
              [new StringFragment('first'), new StringFragment('second')],
              true
            ),
          },
          true
        ),
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
