import { codeBlock } from 'common-tags';
import { massage, parse as parseToml } from './toml';

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
