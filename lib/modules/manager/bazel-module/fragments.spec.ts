import {
  ArrayFragment,
  AttributeFragment,
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
});
