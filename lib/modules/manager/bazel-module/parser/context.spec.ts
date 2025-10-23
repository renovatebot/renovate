import { Ctx, CtxProcessingError } from './context';
import * as fragments from './fragments';

describe('modules/manager/bazel-module/parser/context', () => {
  describe('Ctx (failures cases)', () => {
    describe('extension tag', () => {
      it('throws if there is no current', () => {
        expect(() => new Ctx('').startExtensionTag('install')).toThrow(
          new Error('Requested current, but no value.'),
        );
      });

      it('throws if the current is not a prepared extension tag', () => {
        expect(() =>
          new Ctx('').startRule('foo').startExtensionTag('install'),
        ).toThrow(
          new Error(
            'Requested current prepared extension tag, but does not exist.',
          ),
        );
      });

      it('throws if the current is not an extension tag', () => {
        expect(() => new Ctx('').startRule('foo').endExtensionTag(0)).toThrow(
          new Error('Requested current extension tag, but does not exist.'),
        );
      });
    });

    it('throws on missing current', () => {
      const ctx = new Ctx('');
      expect(() => ctx.endRule()).toThrow(
        new Error('Requested current, but no value.'),
      );
    });

    it('throws on unbalanced endRule', () => {
      const ctx = new Ctx('').startRule('foo').startArray();
      expect(() => ctx.endRule()).toThrow(
        new Error('Requested current rule, but does not exist.'),
      );
    });

    it('throws on unbalanced endArray', () => {
      const ctx = new Ctx('').startArray().startRule('dummy');
      expect(() => ctx.endArray()).toThrow(
        new Error('Requested current array, but does not exist.'),
      );
    });

    it('throws if add an attribute without a parent', () => {
      const ctx = new Ctx('').startAttribute('name');
      expect(() => ctx.addString('chicken')).toThrow(
        new CtxProcessingError(
          fragments.attribute('name', fragments.string('chicken'), true),
        ),
      );
    });

    it('throws if current use repo rule does not exist', () => {
      const ctx = new Ctx('').startRule('foo');
      expect(() => ctx.endUseRepoRule()).toThrow(
        new Error('Requested current use repo rule, but does not exist.'),
      );
    });

    it('throws if current repo rule call does not exist', () => {
      const ctx = new Ctx('').startRule('foo');
      expect(() => ctx.endRepoRuleCall(0)).toThrow(
        new Error('Requested current repo rule call, but does not exist.'),
      );
    });

    it('creates CtxProcessingError with parent type', () => {
      const ctx = new Ctx('').startRule('parent');
      ctx.startAttribute('name');
      const parent = fragments.rule('parent');
      const current = fragments.attribute('name');
      const error = new CtxProcessingError(current, parent);
      expect(error.message).toBe(
        'Invalid context state. current: attribute, parent: rule',
      );
      expect(error.current).toBe(current);
      expect(error.parent).toBe(parent);
    });
  });
});
