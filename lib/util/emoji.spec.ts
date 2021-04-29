import { fromCodepointToUnicode, fromHexcodeToCodepoint } from 'emojibase';
import cldrShortcodes from 'emojibase-data/en/shortcodes/cldr.json';
import githubShortcodes from 'emojibase-data/en/shortcodes/github.json';
import { getName } from '../../test/util';
import { emojify, setEmojiConfig, unemojify } from './emoji';

function findUnsupportedEmoji() {
  const supported = new Set(Object.keys(githubShortcodes));
  const hexCode = Object.keys(cldrShortcodes).find(
    (code) => !supported.has(code)
  );
  return fromCodepointToUnicode(fromHexcodeToCodepoint(hexCode));
}

describe(getName(), () => {
  it('strips emojis when the config has been set accordingly', () => {
    const emoji = '🚀💎';
    const otherText = 'regular text';
    const text = `${emoji} ${otherText}`;
    setEmojiConfig({ unicodeEmoji: false });
    const result = unemojify(text);
    expect(result).not.toContain(emoji);
  });

  it('does not strip emojis when the config demands it', () => {
    const emoji = '🚀💎';
    const otherText = 'regular text';
    const text = `${emoji} ${otherText}`;
    setEmojiConfig({ unicodeEmoji: true });
    const result = unemojify(text);
    expect(result).toEqual(text);
  });

  it('converts between github shortcodes', () => {
    setEmojiConfig({ unicodeEmoji: false });

    const input = 'foo 🧹 bar 🚀 baz 💎 qux 📦 quux';
    const codified = unemojify(input);
    expect(codified).not.toEqual(input);

    setEmojiConfig({ unicodeEmoji: true });
    const emojified = emojify(codified);
    expect(emojified).toEqual(input);
  });

  describe('unsupported characters', () => {
    const unsupported = findUnsupportedEmoji();

    it('uses replacement character', () => {
      setEmojiConfig({ unicodeEmoji: false });
      expect(unemojify(unsupported)).toEqual('�');
    });

    it('uses custom replacement strings', () => {
      setEmojiConfig({ unicodeEmoji: false });
      expect(unemojify(unsupported, '?')).toEqual('?');
      expect(unemojify(`foo${unsupported}bar`, '')).toEqual('foobar');
    });
  });
});
