import { getName } from '../../../../test/util';
import { escapeGfmCommentText, unescapeGfmCommentText } from './gfm';

const testLines = [
  'qwe -- asd',
  'qwe --- asd',
  'qwe -- -- asd',
  '--qwe -- asd--',
];

const testLinesToNotBeChanged = [
  'qwe - - asd',
  '-qwe- -asd-',
  'qwe\u2060asd',
  'qwe\u2060-asd',
  'qwe-\u2060asd',
];

describe(getName(), () => {
  describe('escapeGfmCommentText', () => {
    it('escapes --', () => {
      for (const line of testLines) {
        expect(escapeGfmCommentText(line)).not.toContain('--');
      }
    });

    it('does not change normal lines', () => {
      for (const line of testLinesToNotBeChanged) {
        expect(escapeGfmCommentText(line)).toBe(line);
      }
    });

    it('throws error on preescaped text', () => {
      for (const line of testLines) {
        expect(() => {
          escapeGfmCommentText(escapeGfmCommentText(line));
        }).toThrow();
      }
    });
  });

  describe('unescapeGfmCommentText', () => {
    it('unescapes escaped by escapeGfmCommentText', () => {
      for (const line of testLines) {
        expect(unescapeGfmCommentText(escapeGfmCommentText(line))).toBe(line);
      }
    });

    it('does not change normal lines', () => {
      for (const line of testLinesToNotBeChanged) {
        expect(unescapeGfmCommentText(line)).toBe(line);
      }
    });
  });
});
