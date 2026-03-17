import { Fixtures } from '~test/fixtures.ts';
import { logger } from '~test/util.ts';
import { closeUnclosedStructures, smartTruncate } from './pr-body.ts';

const prBody = Fixtures.get('pr-body.txt');

describe('modules/platform/utils/pr-body', () => {
  describe('.closeUnclosedStructures', () => {
    describe('case 1: closing tag fits within limit', () => {
      it('closes unclosed fenced code block', () => {
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/7
        const input = 'some text\n```bash\necho hello';
        const expected = 'some text\n```bash\necho hello\n```\n';
        const result = closeUnclosedStructures(input, 100);
        expect(result).toBe(expected);
      });

      it('does not treat inner fence-like content as a new fence', () => {
        // ```golang block containing ```typescript is just content,
        // not a nested fence
        const input = '```golang\n```typescript\nfunc main()';
        const expected = '```golang\n```typescript\nfunc main()\n```\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('handles 4-backtick fence containing triple backticks', () => {
        // ```` opens a fence that ``` cannot close
        const input = '````testa\n```test\n```\n```\nmore content';
        const expected = '````testa\n```test\n```\n```\nmore content\n````\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('handles 5-backtick fence', () => {
        const input = '`````markdown\nsome code\n````\n```';
        const expected = '`````markdown\nsome code\n````\n```\n`````\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('does not treat backticks with trailing content as closing fence', () => {
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/14
        // Per CommonMark, a closing fence must have no content after backticks.
        // ````` markdown` (space before "markdown") is NOT a valid closer for `````.
        const input = '`````\nsome code\n````` markdown\nmore code';
        const expected = '`````\nsome code\n````` markdown\nmore code\n`````\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('does not close a fenced code block when the closing fence has trailing content', () => {
        // A closing fence is valid when whitespace follows.
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/16
        const input = '``` lang\nsome code\n```  \nmore code';
        const expected = input;
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('closes unclosed details tag', () => {
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/2
        const input = '<details>\n<summary>Title</summary>\nContent';
        const expected =
          '<details>\n<summary>Title</summary>\nContent\n</details>\n';
        const result = closeUnclosedStructures(input, 100);
        expect(result).toBe(expected);
      });

      it('closes multiple unclosed details tags', () => {
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/10
        const input =
          '<details>\n<summary>Outer</summary>\n<details>\n<summary>Inner</summary>\nContent';
        const expected =
          '<details>\n<summary>Outer</summary>\n<details>\n<summary>Inner</summary>\nContent\n</details>\n\n</details>\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('closes unclosed table tag', () => {
        // https://github.com/Shion1305/renovate-bug-discussion-41912/issues/5
        const input = '<table>\n<tr><td>Cell</td></tr>';
        const expected = '<table>\n<tr><td>Cell</td></tr>\n</table>\n';
        const result = closeUnclosedStructures(input, 100);
        expect(result).toBe(expected);
      });

      it('closes unclosed div tag', () => {
        const input = '<div>\nSome content';
        const expected = '<div>\nSome content\n</div>\n';
        const result = closeUnclosedStructures(input, 100);
        expect(result).toBe(expected);
      });

      it('closes unclosed blockquote tag', () => {
        const input = '<blockquote>\nQuoted text';
        const expected = '<blockquote>\nQuoted text\n</blockquote>\n';
        const result = closeUnclosedStructures(input, 100);
        expect(result).toBe(expected);
      });

      it('closes unclosed summary tag', () => {
        const input = '<details>\n<summary>Title that got cut';
        const expected =
          '<details>\n<summary>Title that got cut\n</summary>\n\n</details>\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('closes both unclosed code fence and HTML tags', () => {
        const input = '<details>\n<summary>Title</summary>\n```js\nconst x = 1';
        const expected =
          '<details>\n<summary>Title</summary>\n```js\nconst x = 1\n```\n\n</details>\n';
        const result = closeUnclosedStructures(input, 200);
        expect(result).toBe(expected);
      });

      it('ignores HTML tags inside a balanced code fence', () => {
        const input = 'before\n```html\n<div>\n<table>\n```\nafter';
        const result = closeUnclosedStructures(input, 500);
        expect(result).toBe(input);
      });

      it('ignores HTML tags inside an unclosed code fence', () => {
        const input = 'before\n```html\n<div>\n<table>';
        const expected = 'before\n```html\n<div>\n<table>\n```\n';
        const result = closeUnclosedStructures(input, 500);
        expect(result).toBe(expected);
      });

      it('closes real HTML tags outside fences while ignoring ones inside', () => {
        const input =
          '<details>\n<summary>Title</summary>\n```html\n<div>\n```\nContent';
        const expected =
          '<details>\n<summary>Title</summary>\n```html\n<div>\n```\nContent\n</details>\n';
        const result = closeUnclosedStructures(input, 500);
        expect(result).toBe(expected);
      });
    });

    describe('case 2: closing tag exceeds limit, trim back', () => {
      it('trims content inside tag to fit closing tag', () => {
        // maxLen = input.length, no room to append </details>
        // but we can trim content and still close the tag
        const input = '<details>\n<summary>Title</summary>\nContent';
        const expected = '<details>\n<summary\n</details>\n';
        const maxLen = input.length;
        const result = closeUnclosedStructures(input, maxLen);
        // Trimming cuts into </summary>, leaving <summary as partial
        // (not matched as an open tag), so only </details> is needed
        expect(result).toBe(expected);
      });

      it('trims content inside code fence to fit closing fence', () => {
        const input = 'text before\n```bash\necho hello';
        const expected = 'text before\n```bash\necho \n```\n';
        const maxLen = input.length;
        const result = closeUnclosedStructures(input, maxLen);
        expect(result).toBe(expected);
      });

      it('trims content inside 4-backtick fence to fit closing fence', () => {
        const input = 'text before\n````bash\necho hello';
        const expected = 'text before\n````bash\necho\n````\n';
        const maxLen = input.length;
        const result = closeUnclosedStructures(input, maxLen);
        expect(result).toBe(expected);
      });

      it('removes tag entirely when opening tag + closing tag exceeds limit', () => {
        // maxLen so small that <details> + </details> alone won't fit
        const input = '<details>\nContent';
        const result = closeUnclosedStructures(input, 5);
        expect(result).toBe('');
      });
    });

    describe('no changes needed', () => {
      it('does not modify text with balanced code fences', () => {
        const input = 'some text\n```bash\necho hello\n```\nmore text';
        const result = closeUnclosedStructures(input, 1000);
        expect(result).toBe(input);
      });

      it('does not modify text with balanced details tags', () => {
        const input =
          '<details>\n<summary>Title</summary>\nContent\n</details>';
        const result = closeUnclosedStructures(input, 1000);
        expect(result).toBe(input);
      });

      it('does not modify text with balanced tags', () => {
        const input =
          '<table>\n<tr><td>Cell</td></tr>\n</table>\n<div>Content</div>';
        const result = closeUnclosedStructures(input, 1000);
        expect(result).toBe(input);
      });

      it('returns empty string unchanged', () => {
        const result = closeUnclosedStructures('', 1000);
        expect(result).toBe('');
      });
    });
  });

  describe('.smartTruncate', () => {
    it('truncates to 1000', () => {
      const body = smartTruncate(prBody, 1000);
      expect(body).toMatchSnapshot();
      expect(body.length < prBody.length).toBe(true);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 1000 characters',
      );
    });

    it('truncates to 300 not smart', () => {
      const body = smartTruncate(prBody, 300);
      expect(body).toMatchSnapshot();
      expect(body).toHaveLength(300);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 300 characters',
      );
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toBe('> ℹ️ **Not');
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 10 characters',
      );
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody, 60000)).toEqual(prBody);
    });
  });
});
