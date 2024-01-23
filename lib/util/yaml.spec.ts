import { codeBlock } from 'common-tags';
import { z } from 'zod';
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

    it('should parse content with single document with schema', () => {
      expect(
        parseYaml(
          codeBlock`
      myObject:
        aString: value
      `,
          null,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
          },
        ),
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

    it('should parse content with multiple documents with schema', () => {
      expect(
        parseYaml(
          codeBlock`
      myObject:
        aString: foo
      ---
      myObject:
        aString: bar
      `,
          null,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
          },
        ),
      ).toEqual([
        {
          myObject: {
            aString: 'foo',
          },
        },
        {
          myObject: {
            aString: 'bar',
          },
        },
      ]);
    });

    it('should throw if schema does not match', () => {
      expect(() =>
        parseYaml(
          codeBlock`
      myObject:
        aString: foo
      ---
      aString: bar
      `,
          null,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
          },
        ),
      ).toThrow();
    });

    it('should throw if schema does not match and failureBehaviour "throw"', () => {
      expect(() =>
        parseYaml(
          codeBlock`
      myObject:
        aString: foo
      ---
      aString: bar
      `,
          null,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
            failureBehaviour: 'throw',
          },
        ),
      ).toThrow();
    });

    it('should still return valid elements if schema does not match with "filter" behaviour', () => {
      expect(
        parseYaml(
          codeBlock`
      myObject:
        aString: foo
      ---
      aString: bar
      `,
          null,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
            failureBehaviour: 'filter',
          },
        ),
      ).toEqual([
        {
          myObject: {
            aString: 'foo',
          },
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

    it('should parse content with single document with schema', () => {
      expect(
        parseSingleYaml(
          codeBlock`
      myObject:
        aString: value
      `,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
          },
        ),
      ).toEqual({
        myObject: {
          aString: 'value',
        },
      });
    });

    it('should throw with single document with schema if parsing fails', () => {
      expect(() =>
        parseSingleYaml(
          codeBlock`
      myObject: foo
      `,
          {
            customSchema: z.object({
              myObject: z.object({
                aString: z.string(),
              }),
            }),
          },
        ),
      ).toThrow();
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
            aNestedString: null,
          },
        },
      });
    });
  });
});
