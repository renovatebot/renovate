import { codeBlock } from 'common-tags';
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import * as plugin from './index.mjs';

const OPTIONS = { parser: 'markdown', plugins: [plugin] };

/** @param {string} text */
async function fmt(text) {
  return format(text, OPTIONS);
}

/**
 * Tagged template: strips common indentation (via codeBlock) then appends a
 * trailing newline, matching the trailing newline prettier always emits.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
function block(strings, ...values) {
  return `${codeBlock(strings, ...values)}\n`;
}

describe('mkdocs-admonitions prettier plugin', () => {
  it('normalizes 4-space body to 2-space', async () => {
    const input = block`
      !!! note
          This is the body.
    `;
    const expected = block`
      !!! note
        This is the body.
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('preserves 2-space-indented body (mirrors typst/readme.md)', async () => {
    const input = block`
      !!! note
        Body with two spaces.
    `;
    await expect(fmt(input)).resolves.toBe(input);
  });

  it('normalizes multi-line body with internal blank line from 4 to 2 spaces', async () => {
    const input = block`
      !!! note
          First paragraph.

          Second paragraph.
    `;
    const expected = block`
      !!! note
        First paragraph.

        Second paragraph.
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('normalizes body of !!! warning with quoted title from 4 to 2 spaces', async () => {
    const input = block`
      !!! warning "Custom Title"
          Content here.
    `;
    const expected = block`
      !!! warning "Custom Title"
        Content here.
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('preserves empty-body admonition', async () => {
    const input = '!!! note\n';
    await expect(fmt(input)).resolves.toBe(input);
  });

  it('does not mask admonitions inside fenced code blocks', async () => {
    const input = block`
      \`\`\`
      !!! note
          body
      \`\`\`
    `;
    const output = await fmt(input);
    // Content inside the fence must be preserved verbatim
    expect(output).toContain('!!! note\n    body');
    // No placeholder should leak into the output
    expect(output).not.toContain('<!--mkdocs-admonition:');
  });

  it('reformats surrounding markdown while preserving admonition', async () => {
    const input = block`
      # Heading

      Some   extra   spaces.

      !!! note
          Body.

      More text.
    `;
    const output = await fmt(input);
    expect(output).toContain('!!! note\n  Body.');
    // Prettier normalizes the paragraph's extra spaces
    expect(output).not.toContain('Some   extra   spaces.');
    expect(output).toContain('Some extra spaces.');
  });

  it('preserves admonition alongside existing <!-- prettier-ignore -->', async () => {
    const input = block`
      <!-- prettier-ignore -->
      !!! note
          Body.

      !!! tip
          Other.
    `;
    const output = await fmt(input);
    expect(output).toContain('!!! note\n  Body.');
    expect(output).toContain('!!! tip\n  Other.');
  });

  it('normalizes ??? collapsible admonition body from 4 to 2 spaces', async () => {
    const input = block`
      ??? note
          This is collapsible.
    `;
    const expected = block`
      ??? note
        This is collapsible.
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('normalizes ???+ collapsible admonition body from 4 to 2 spaces', async () => {
    const input = block`
      ???+ tip
          This is open by default.
    `;
    const expected = block`
      ???+ tip
        This is open by default.
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('preserves relative indent of nested content while normalizing base to 2 spaces', async () => {
    const input = block`
      !!! note
          outer
              inner
    `;
    const expected = block`
      !!! note
        outer
            inner
    `;
    await expect(fmt(input)).resolves.toBe(expected);
  });

  it('throws when source contains collision guard string', async () => {
    await expect(
      fmt('Text containing mkdocs-admonition: in it.\n'),
    ).rejects.toThrow('mkdocs-admonition:');
  });
});
