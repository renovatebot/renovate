import { codeBlock } from 'common-tags';
import { load, loadAll } from './yaml';

describe('util/yaml', () => {
  describe('loadAll', () => {
    it('should return empty array for empty string', () => {
      expect(loadAll(``)).toEqual([]);
    });

    it('should parse content with single document', () => {
      expect(
        loadAll(codeBlock`
      myObject:
        aString: value
      `),
      ).toEqual([
        {
          myObject: {
            aString: 'value',
          },
        },
      ]);
    });

    it('should parse content with multiple documents', () => {
      expect(
        loadAll(codeBlock`
      myObject:
        aString: value
      ---
      foo: bar
      `),
      ).toEqual([
        {
          myObject: {
            aString: 'value',
          },
        },
        {
          foo: 'bar',
        },
      ]);
    });

    it('should parse content with templates', () => {
      expect(
        loadAll(
          codeBlock`
      myObject:
        aString: {{ value }}
      ---
      foo: {{ foo.bar }}
      `,
          undefined,
          { removeTemplates: true },
        ),
      ).toEqual([
        {
          myObject: {
            aString: null,
          },
        },
        {
          foo: null,
        },
      ]);
    });
  });

  describe('load', () => {
    it('should return undefined', () => {
      expect(load(``)).toBeUndefined();
    });

    it('should parse content with single document', () => {
      expect(
        load(codeBlock`
      myObject:
        aString: value
      `),
      ).toEqual({
        myObject: {
          aString: 'value',
        },
      });
    });

    it('should parse content with multiple documents', () => {
      expect(() =>
        load(codeBlock`
      myObject:
        aString: value
      ---
      foo: bar
      `),
      ).toThrow();
    });

    it('should parse content with template', () => {
      expect(
        load(
          codeBlock`
      myObject:
        aString: {{value}}
      `,
          { removeTemplates: true },
        ),
      ).toEqual({
        myObject: {
          aString: null,
        },
      });
    });
  });
});
