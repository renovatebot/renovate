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
  it('preserves simple !!! note with 4-space body', async () => {
    const input = block`
      !!! note
          This is the body.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves 2-space-indented body (mirrors typst/readme.md)', async () => {
    const input = block`
      !!! note
        Body with two spaces.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves 3-space-indented body (mirrors configuration-options.md)', async () => {
    const input = block`
      !!! note
         Body with three spaces.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves 5-space-indented body (mirrors self-hosted-configuration.md)', async () => {
    const input = block`
      !!! note
           Renovate supports \`JSONC\` for \`.json\` files.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves multi-line body with internal blank line', async () => {
    const input = block`
      !!! note
          First paragraph.

          Second paragraph.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves !!! warning with quoted title', async () => {
    const input = block`
      !!! warning "Custom Title"
          Content here.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves empty-body admonition', async () => {
    const input = '!!! note\n';
    expect(await fmt(input)).toBe(input);
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
    expect(output).toContain('!!! note\n    Body.');
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
    expect(output).toContain('!!! note\n    Body.');
    expect(output).toContain('!!! tip\n    Other.');
  });

  it('preserves ??? collapsible admonition (closed by default)', async () => {
    const input = block`
      ??? note
          This is collapsible.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves ???+ collapsible admonition (open by default)', async () => {
    const input = block`
      ???+ tip
          This is open by default.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves ??? collapsible with quoted title', async () => {
    const input = block`
      ??? warning "Custom Title"
          Content here.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('preserves ???+ collapsible with multi-line body', async () => {
    const input = block`
      ???+ note "Title"
          First paragraph.

          Second paragraph.
    `;
    expect(await fmt(input)).toBe(input);
  });

  it('throws when source contains collision guard string', async () => {
    await expect(
      fmt('Text containing mkdocs-admonition: in it.\n'),
    ).rejects.toThrow('mkdocs-admonition:');
  });
});
