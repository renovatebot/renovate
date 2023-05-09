import {
  ArrayFragment,
  AttributeFragment,
  BooleanFragment,
  FragmentType,
  RecordFragment,
  StringFragment,
  ValueFragment,
  asFragment,
  asValue,
  safeAsValue,
} from './fragments';

describe('modules/manager/bazel-module/fragments', () => {
  describe('StringFragment', () => {
    it('lifecycle ', () => {
      const string = new StringFragment('hello');
      expect(string.value).toBe('hello');
      expect(string.isComplete).toBe(true);
    });
  });

  describe('BooleanFragment', () => {
    it('lifecycle ', () => {
      const bool = new BooleanFragment(true);
      expect(bool.value).toBe(true);
      expect(bool.isComplete).toBe(true);
    });

    it.each`
      a          | exp
      ${true}    | ${true}
      ${false}   | ${false}
      ${'True'}  | ${true}
      ${'False'} | ${false}
    `('new BooleanFragment($a)', ({ a, exp }) => {
      const bool = new BooleanFragment(a);
      expect(bool.value).toBe(exp);
    });

    it.each`
      a
      ${'true'}
      ${'false'}
      ${''}
    `('new BooleanFragment($a)', ({ a }) => {
      expect(() => new BooleanFragment(a)).toThrow();
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

    describe('as', () => {
      it('returns an ArrayFragment', () => {
        const frag: {
          type: FragmentType;
          isComplete: boolean;
          items: ValueFragment[];
        } = {
          type: 'array',
          isComplete: false,
          items: [new StringFragment('hello')],
        };
        const result = ArrayFragment.as(frag);
        expect(result).toEqual(frag);
        expect(result).toBeInstanceOf(ArrayFragment);
      });
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

    describe('as', () => {
      it('returns an AttributeFragment', () => {
        const frag = {
          type: 'attribute',
          name: 'greeting',
          value: new StringFragment('hello'),
        };
        const result = AttributeFragment.as(frag);
        expect(result).toEqual(frag);
      });
    });
  });

  describe('Fragments', () => {
    it.each`
      frag                             | exp
      ${new StringFragment('hello')}   | ${new StringFragment('hello')}
      ${new ArrayFragment()}           | ${new ArrayFragment()}
      ${new RecordFragment()}          | ${new RecordFragment()}
      ${new AttributeFragment('name')} | ${null}
    `('safeAsValue($frag)', ({ frag, exp }) => {
      const result = safeAsValue(frag);
      expect(result).toEqual(exp);
    });

    describe('asValue', () => {
      it('returns the instance when it is a value fragment', () => {
        const value = new StringFragment('hello');
        const result = asValue(value);
        expect(result).toEqual(value);
      });

      it('throws when it is not a value fragment', () => {
        const attribute = new AttributeFragment('name');
        expect(() => asValue(attribute)).toThrow();
      });
    });

    it.each`
      frag                             | exp
      ${new StringFragment('hello')}   | ${new StringFragment('hello')}
      ${new ArrayFragment()}           | ${new ArrayFragment()}
      ${new RecordFragment()}          | ${new RecordFragment()}
      ${new AttributeFragment('name')} | ${new AttributeFragment('name')}
    `('asFragment($frag)', ({ frag, exp }) => {
      const result = asFragment(frag);
      expect(result).toEqual(exp);
    });

    it.each`
      fn                      | frag
      ${StringFragment.as}    | ${new ArrayFragment()}
      ${ArrayFragment.as}     | ${new RecordFragment()}
      ${RecordFragment.as}    | ${new ArrayFragment()}
      ${AttributeFragment.as} | ${new ArrayFragment()}
    `('$fn throws with $frag', ({ fn, frag }) => {
      expect(() => fn(frag)).toThrow();
    });
  });
});
