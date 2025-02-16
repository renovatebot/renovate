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
        fragments.rule(
          'bazel_dep',
          {
            name: fragments.string('rules_foo'),
            version: fragments.string('1.2.3'),
          },
          true,
        ),
      ]);
    });

    it('construct simple bazel_dep with no version', () => {
      const ctx = new Ctx()
        .startRule('bazel_dep')
        .startAttribute('name')
        .addString('rules_foo')
        .endRule();

      expect(ctx.results).toEqual([
        fragments.rule(
          'bazel_dep',
          {
            name: fragments.string('rules_foo'),
          },
          true,
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
        fragments.rule(
          'foo_library',
          {
            name: fragments.string('my_library'),
            srcs: fragments.array(
              [fragments.string('first'), fragments.string('second')],
              true,
            ),
          },
          true,
        ),
      ]);
    });

    it('construct an extension tag', () => {
      const ctx = new Ctx()
        .prepareExtensionTag('maven', 'maven_01')
        .startExtensionTag('install')
        .startAttribute('artifacts')
        .startArray()
        .addString('org.example:my-lib:1.0.0')
        .endArray()
        .endExtensionTag();

      expect(ctx.results).toEqual([
        fragments.extensionTag(
          'maven',
          'maven_01',
          'install',
          {
            artifacts: fragments.array(
              [fragments.string('org.example:my-lib:1.0.0')],
              true,
            ),
          },
          true,
        ),
      ]);
    });

    describe('extension tag failure cases', () => {
      it('throws if there is no current', () => {
        expect(() => new Ctx().startExtensionTag('install')).toThrow(
          new Error('Requested current, but no value.'),
        );
      });

      it('throws if the current is not a prepared extension tag', () => {
        expect(() =>
          new Ctx().startRule('foo').startExtensionTag('install'),
        ).toThrow(
          new Error(
            'Requested current prepared extension tag, but does not exist.',
          ),
        );
      });

      it('throws if the current is not an extension tag', () => {
        expect(() => new Ctx().startRule('foo').endExtensionTag()).toThrow(
          new Error('Requested current extension tag, but does not exist.'),
        );
      });
    });

    it('throws on missing current', () => {
      const ctx = new Ctx();
      expect(() => ctx.endRule()).toThrow(
        new Error('Requested current, but no value.'),
      );
    });

    it('throws on unbalanced endRule', () => {
      const ctx = new Ctx().startRule('foo').startArray();
      expect(() => ctx.endRule()).toThrow(
        new Error('Requested current rule, but does not exist.'),
      );
    });

    it('throws on unbalanced endArray', () => {
      const ctx = new Ctx().startArray().startRule('dummy');
      expect(() => ctx.endArray()).toThrow(
        new Error('Requested current array, but does not exist.'),
      );
    });

    it('throws if add an attribute without a parent', () => {
      const ctx = new Ctx().startAttribute('name');
      expect(() => ctx.addString('chicken')).toThrow(
        new CtxProcessingError(
          fragments.attribute('name', fragments.string('chicken')),
        ),
      );
    });
  });
});
