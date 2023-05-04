import { Ctx } from './context';
import { ArrayFragment, RecordFragment, StringFragment } from './fragments';

describe('modules/manager/bazel-module/context', () => {
  describe('Ctx', () => {
    it('construct simple bazel_dep', () => {
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
        .startAttribute('tags')
        .startRule('get_tags')
        .endRule()
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
            tags: new RecordFragment(
              { rule: new StringFragment('get_tags') },
              true
            ),
          },
          true
        ),
      ]);
    });

    describe('currentRecord', () => {
      it('returns the record fragment if it is current', () => {
        const ctx = new Ctx().startRecord();
        expect(ctx.currentRecord).toEqual(new RecordFragment());
      });

      it('throws if the current is not a record fragment', () => {
        const ctx = new Ctx().startArray();
        expect(() => ctx.currentRecord).toThrow(
          new Error('Requested current record, but does not exist.')
        );
      });
    });

    describe('currentArray', () => {
      it('returns the array fragment if it is current', () => {
        const ctx = new Ctx().startArray();
        expect(ctx.currentArray).toEqual(new ArrayFragment());
      });

      it('throws if the current is not a record fragment', () => {
        const ctx = new Ctx().startRecord();
        expect(() => ctx.currentArray).toThrow(
          new Error('Requested current array, but does not exist.')
        );
      });
    });

    it('throws if add an attribute without a record', () => {
      const ctx = new Ctx().startAttribute('name');
      expect(() => ctx.addString('chicken')).toThrow(
        new Error('Processing an attribute but there is no parent.')
      );
    });
  });

  describe('Ctx.as', () => {
    it('adds the appropriate prototype to the context and referenced fragments', () => {
      // Ensure that we have values in results (bazel_dep) and the stack (foo_library).
      const ctx = new Ctx()
        .startRule('bazel_dep')
        .startAttribute('name')
        .addString('rules_foo')
        .startAttribute('version')
        .addString('1.2.3')
        .endRule()
        .startRule('foo_library');
      const result = Ctx.as(ctx);
      expect(result).toEqual(ctx);
    });
  });
});
