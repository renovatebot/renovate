import {
  ArrayFragmentSchema,
  AttributeFragmentSchema,
  BooleanFragmentSchema,
  ExtensionTagFragmentSchema,
  PreparedExtensionTagFragmentSchema,
  RuleFragmentSchema,
  StringFragmentSchema,
} from './fragments';
import * as fragments from './fragments';

describe('modules/manager/bazel-module/fragments', () => {
  it('.string()', () => {
    const result = fragments.string('hello');
    expect(() => StringFragmentSchema.parse(result)).not.toThrow();
    expect(result.value).toBe('hello');
  });

  it('.boolean()', () => {
    const result = fragments.boolean(true);
    expect(() => BooleanFragmentSchema.parse(result)).not.toThrow();
    expect(result.value).toBe(true);
  });

  it('.rule()', () => {
    const result = fragments.rule(
      'foo',
      { name: fragments.string('bar') },
      true,
    );
    expect(() => RuleFragmentSchema.parse(result)).not.toThrow();
    expect(result.rule).toBe('foo');
    expect(result.children).toEqual({ name: fragments.string('bar') });
    expect(result.isComplete).toBe(true);
  });

  it('.extensionTag()', () => {
    const result = fragments.extensionTag(
      'ext',
      'ext_01',
      'tag',
      { name: fragments.string('bar') },
      true,
    );

    expect(() => ExtensionTagFragmentSchema.parse(result)).not.toThrow();
    expect(result.extension).toBe('ext');
    expect(result.rawExtension).toBe('ext_01');
    expect(result.tag).toBe('tag');
    expect(result.children).toEqual({ name: fragments.string('bar') });
    expect(result.isComplete).toBe(true);
  });

  it('.preparedExtensionTag()', () => {
    const result = fragments.preparedExtensionTag('ext', 'ext_01');

    expect(() =>
      PreparedExtensionTagFragmentSchema.parse(result),
    ).not.toThrow();
    expect(result.extension).toBe('ext');
    expect(result.rawExtension).toBe('ext_01');
    expect(result.isComplete).toBe(false);
  });

  it('.attribute()', () => {
    const result = fragments.attribute('name', fragments.string('foo'), true);
    expect(() => AttributeFragmentSchema.parse(result)).not.toThrow();
    expect(result.name).toBe('name');
    expect(result.value).toEqual(fragments.string('foo'));
    expect(result.isComplete).toBe(true);
  });

  it('.array()', () => {
    const result = fragments.array([fragments.string('foo')], true);
    expect(() => ArrayFragmentSchema.parse(result)).not.toThrow();
    expect(result.items).toEqual([fragments.string('foo')]);
    expect(result.isComplete).toBe(true);
  });

  it.each`
    a                                                  | exp
    ${fragments.string('hello')}                       | ${true}
    ${fragments.boolean(true)}                         | ${true}
    ${fragments.array()}                               | ${true}
    ${fragments.rule('dummy')}                         | ${false}
    ${fragments.extensionTag('ext', 'ext_01', 'tag')}  | ${false}
    ${fragments.preparedExtensionTag('ext', 'ext_01')} | ${false}
  `('.isValue($a)', ({ a, exp }) => {
    expect(fragments.isValue(a)).toBe(exp);
  });

  it.each`
    a                                                  | exp
    ${fragments.string('hello')}                       | ${true}
    ${fragments.boolean(true)}                         | ${true}
    ${fragments.array()}                               | ${false}
    ${fragments.rule('dummy')}                         | ${false}
    ${fragments.extensionTag('ext', 'ext_01', 'tag')}  | ${false}
    ${fragments.preparedExtensionTag('ext', 'ext_01')} | ${false}
  `('.isPrimitive($a)', ({ a, exp }) => {
    expect(fragments.isPrimitive(a)).toBe(exp);
  });
});
