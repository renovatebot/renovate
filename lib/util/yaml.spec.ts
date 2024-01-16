import { codeBlock } from 'common-tags';
import { parseSingleYaml, parseYaml } from './yaml';

describe('util/yaml', () => {
  describe('loadAll', () => {
    it('should return empty array for empty string', () => {
      expect(parseYaml(``)).toEqual([]);
    });

    it('should parse content with single document', () => {
      expect(
        parseYaml(codeBlock`
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
        parseYaml(codeBlock`
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
        parseYaml(
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
      expect(parseSingleYaml(``)).toBeUndefined();
    });

    it('should parse content with single document', () => {
      expect(
        parseSingleYaml(codeBlock`
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
        parseSingleYaml(codeBlock`
      myObject:
        aString: value
      ---
      foo: bar
      `),
      ).toThrow();
    });

    it('should parse content with template', () => {
      expect(
        parseSingleYaml(
          codeBlock`
      myObject:
        aString: {{value}}
        {% if test.enabled %}
        myNestedObject:
          aNestedString: {{value}}
        {% endif %}
      `,
          { removeTemplates: true },
        ),
      ).toEqual({
        myObject: {
          aString: null,
          myNestedObject: {
            aNestedString: null
          }
        },
      });
    });
  });
});
