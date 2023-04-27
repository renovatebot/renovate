import {
  ArrayFragment,
  AttributeFragment,
  Fragments,
  RecordFragment,
  StringFragment,
} from './fragments';

describe('modules/manager/bazel-module/fragments', () => {
  describe('StringFragment', () => {
    it('constructor ', () => {
      const string = new StringFragment('hello');
      expect(string.value).toBe('hello');
      expect(string.isComplete).toBe(true);
    });
  });

  describe('ArrayFragment', () => {
    it('lifecycle', () => {
      const array = new ArrayFragment();
      expect(array.items).toHaveLength(0);
      expect(array.isComplete).toBe(false);

      array.addValue(new StringFragment('hello'));
      expect(array.items).toEqual([new StringFragment('hello')]);
      expect(array.isComplete).toBe(false);
    });
  });

  describe('RecordFragment', () => {
    it('lifecycle', () => {
      const record = new RecordFragment();
      expect(record.children).toEqual({});
      expect(record.isComplete).toBe(false);

      const attribute = new AttributeFragment(
        'name',
        new StringFragment('chicken')
      );
      record.addAttribute(attribute);
      expect(record.children).toEqual({ name: new StringFragment('chicken') });
      expect(record.isComplete).toBe(false);

      const badAttribute = new AttributeFragment('type');
      expect(() => record.addAttribute(badAttribute)).toThrow(
        new Error('The attribute fragment does not have a value.')
      );
      expect(record.children).toEqual({ name: new StringFragment('chicken') });
      expect(record.isComplete).toBe(false);
    });
  });

  describe('AttributeFragment', () => {
    it('lifecycle', () => {
      const attribute = new AttributeFragment('name');
      expect(attribute.name).toBe('name');
      expect(attribute.value).toBeUndefined();
      expect(attribute.isComplete).toBe(false);

      const value = new StringFragment('chicken');
      attribute.addValue(value);
      expect(attribute.value).toEqual(value);
      expect(attribute.isComplete).toBe(true);
    });
  });

  describe('Fragments', () => {
    it.each`
      frag                             | exp
      ${new StringFragment('hello')}   | ${new StringFragment('hello')}
      ${new ArrayFragment()}           | ${new ArrayFragment()}
      ${new RecordFragment()}          | ${new RecordFragment()}
      ${new AttributeFragment('name')} | ${undefined}
    `('Fragments.safeAsValue($frag)', ({ frag, exp }) => {
      const result = Fragments.safeAsValue(frag);
      expect(result).toEqual(exp);
    });

    describe('asValue', () => {
      it('returns the instance when it is a value fragment', () => {
        const value = new StringFragment('hello');
        const result = Fragments.asValue(value);
        expect(result).toEqual(value);
      });

      it('throws when it is not a value fragment', () => {
        const attribute = new AttributeFragment('name');
        expect(() => Fragments.asValue(attribute)).toThrow(
          new Error(`Unexpected fragment type: attribute`)
        );
      });
    });

    it.each`
      frag                             | exp
      ${new StringFragment('hello')}   | ${new StringFragment('hello')}
      ${new ArrayFragment()}           | ${new ArrayFragment()}
      ${new RecordFragment()}          | ${new RecordFragment()}
      ${new AttributeFragment('name')} | ${new AttributeFragment('name')}
    `('Fragments.asFragment($frag)', ({ frag, exp }) => {
      const result = Fragments.asFragment(frag);
      expect(result).toEqual(exp);
    });

    it.each`
      fn                       | frag
      ${Fragments.asString}    | ${new ArrayFragment()}
      ${Fragments.asArray}     | ${new RecordFragment()}
      ${Fragments.asRecord}    | ${new ArrayFragment()}
      ${Fragments.asAttribute} | ${new ArrayFragment()}
    `('$fn throws with $frag', ({ fn, frag }) => {
      expect(() => fn(frag)).toThrow();
    });
  });
});
