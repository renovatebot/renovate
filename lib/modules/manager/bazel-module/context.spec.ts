import { Ctx, CtxProcessingError } from './context';
import * as fragments from './fragments';

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
        fragments.record(
          {
            rule: fragments.string('bazel_dep'),
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
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
        .addString('first')
        .addString('second')
        .endArray()
        .endRule();

      expect(ctx.results).toEqual([
        fragments.record(
          {
            rule: fragments.string('foo_library'),
            name: fragments.string('my_library'),
            srcs: fragments.array(
              [fragments.string('first'), fragments.string('second')],
              true
            ),
          },
          true
        ),
      ]);
    });

    describe('.current', () => {
      it('returns the last fragment in the stack if it exists', () => {
        const ctx = new Ctx().startRecord();
        const current = ctx.current;
        expect(current.type).toBe('record');
      });

      it('throws if the stack is empty', () => {
        const ctx = new Ctx();
        expect(() => ctx.current).toThrow(
          new Error('Requested current, but no value.')
        );
      });
    });

    describe('.currentRecord', () => {
      it('returns the record fragment if it is current', () => {
        const ctx = new Ctx().startRecord();
        expect(ctx.currentRecord).toEqual(fragments.record());
      });

      it('throws if the current is not a record fragment', () => {
        const ctx = new Ctx().startArray();
        expect(() => ctx.currentRecord).toThrow(
          new Error('Requested current record, but does not exist.')
        );
      });
    });

    describe('.currentArray', () => {
      it('returns the array fragment if it is current', () => {
        const ctx = new Ctx().startArray();
        expect(ctx.currentArray).toEqual(fragments.array());
      });

      it('throws if the current is not a record fragment', () => {
        const ctx = new Ctx().startRecord();
        expect(() => ctx.currentArray).toThrow(
          new Error('Requested current array, but does not exist.')
        );
      });
    });

    it('throws if add an attribute without a parent', () => {
      const ctx = new Ctx().startAttribute('name');
      expect(() => ctx.addString('chicken')).toThrow(
        new CtxProcessingError(
          fragments.attribute('name', fragments.string('chicken'))
        )
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
