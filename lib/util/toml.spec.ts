import { codeBlock } from 'common-tags';
import { massage, parseTOMLDocument, parse as parseToml } from './toml.ts';

describe('util/toml', () => {
  it('exposes source ranges from the TOML AST', () => {
    const document = parseTOMLDocument('[[tools.node]]\nversion = "20.11.0"\n');

    expect(document.body[0].body[0]).toMatchObject({
      range: [0, 34],
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
