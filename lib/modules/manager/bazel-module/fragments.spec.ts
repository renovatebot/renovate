import {
  ArrayFragmentSchema,
  AttributeFragmentSchema,
  BooleanFragmentSchema,
  RecordFragmentSchema,
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

  it('.record()', () => {
    const result = fragments.record({ name: fragments.string('foo') }, true);
    expect(() => RecordFragmentSchema.parse(result)).not.toThrow();
    expect(result.children).toEqual({ name: fragments.string('foo') });
    expect(result.isComplete).toBe(true);
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
    a                            | exp
    ${fragments.string('hello')} | ${true}
    ${fragments.boolean(true)}   | ${true}
    ${fragments.array()}         | ${true}
    ${fragments.record()}        | ${false}
  `('.isValue($a)', ({ a, exp }) => {
    expect(fragments.isValue(a)).toBe(exp);
  });

  it.each`
    a                            | exp
    ${fragments.string('hello')} | ${true}
    ${fragments.boolean(true)}   | ${true}
    ${fragments.array()}         | ${false}
    ${fragments.record()}        | ${false}
  `('.isValue($a)', ({ a, exp }) => {
    expect(fragments.isPrimitive(a)).toBe(exp);
  });
});
