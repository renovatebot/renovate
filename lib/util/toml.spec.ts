import { codeBlock } from 'common-tags';
import { parse as parseToml } from './toml';

describe('util/toml', () => {
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

  it('handles invalid toml', () => {
    const input = codeBlock`
      !@#$%^&*()
    `;

    expect(() => parseToml(input)).toThrow(SyntaxError);
  });

  it('should parse content with templates', () => {
    const input = codeBlock`
      [project]
      name = "{{ value }}"

      {# comment #}
      [tool.poetry.dependencies]
      {% if enabled %}
      python = "^3.12"
      {%+ endif -%}
    `;
    expect(parseToml(input)).toStrictEqual({
      project: { name: '' },
      tool: {
        poetry: {
          dependencies: { python: '^3.12' },
        },
      },
    });
  });
});
