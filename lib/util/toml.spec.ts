import { codeBlock } from 'common-tags';
import {
  massage,
  massageWithSourceMap,
  parseTOMLDocument,
  parse as parseToml,
} from './toml.ts';

describe('util/toml', () => {
  it('maps offsets through removed template keys and expressions', () => {
    const input = codeBlock`
      before = "1"
      {{ key }} = "{{ value }}"
      {% if enabled %}
      middle = "2"
      {# multiline
      {{ nested }} = "ignored"
      comment #}
      after = "3"
      {% endif %}
    `;

    const { content, toOriginalOffset } = massageWithSourceMap(input);

    expect(parseToml(content)).toEqual({
      before: '1',
      middle: '2',
      after: '3',
    });
    for (const value of ['1', '2', '3']) {
      expect(toOriginalOffset(content.indexOf(value))).toBe(
        input.indexOf(value),
      );
    }
    expect(toOriginalOffset(content.length)).toBe(input.length);
  });

  it('exposes source ranges from the TOML AST', () => {
    const document = parseTOMLDocument('[[tools.node]]\nversion = "20.11.0"\n');

    expect(document.body[0].body[0]).toMatchObject({
      range: [0, 34],
    });
  });

  it('parses TOML 1.1 syntax with source ranges', () => {
    const document = parseTOMLDocument(
      '[[tools.node]]\nplatforms = { linux = { checksum = "abc", }, }\n',
    );

    expect(document.body[0].body[0]).toMatchObject({
      type: 'TOMLTable',
    });
  });

  it('works', () => {
    const input = codeBlock`
      [tool.poetry]
      ## Hello world
      include = [
        "README.md",
        { path = "tests", format = "sdist" }
      ]
    `;

    expect(parseToml(input)).toStrictEqual({
      tool: {
        poetry: {
          include: ['README.md', { path: 'tests', format: 'sdist' }],
        },
      },
    });
  });

  it('parses toml 1.1 syntax', () => {
    const input = codeBlock`
      [tool.poetry]
      include = { path = "README.md", }
    `;

    expect(parseToml(input)).toStrictEqual({
      tool: {
        poetry: {
          include: { path: 'README.md' },
        },
      },
    });
  });

  it('handles invalid toml', () => {
    const input = codeBlock`
      !@#$%^&*()
    `;

    expect(() => parseToml(input)).toThrow(SyntaxError);
  });

  it('handles templates', () => {
    const input = codeBlock`
      [tool.poetry]
      name = "{{ name }}"
      {# comment #}
      [tool.poetry.dependencies]
      python = "^3.9"
      {{ foo }} = "{{ bar }}"
      {% if foo %}
      dep1 = "^1.0.0"
      {% endif %}
    `;

    expect(() => parseToml(massage(input))).not.toThrow(SyntaxError);
  });
});
