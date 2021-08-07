import { fromCodepointToUnicode, fromHexcodeToCodepoint } from 'emojibase';
import { getName } from '../../test/util';
import { emojify, setEmojiConfig, stripEmojis, unemojify } from './emoji';

describe(getName(), () => {
  beforeEach(() => {
    setEmojiConfig({ unicodeEmoji: true });
  });

  describe('emojify', () => {
    it('encodes known shortcodes', () => {
      expect(emojify('Let it :bee:')).toEqual('Let it 🐝');
    });

    it('encodes aliases', () => {
      const bee = emojify(':bee:');
      const honeyBee = emojify(':honeybee:');
      expect(bee).toEqual(honeyBee);
    });

    it('omits unknown shortcodes', () => {
      expect(emojify(':foo: :bar: :bee:')).toEqual(':foo: :bar: 🐝');
    });

    it('does not encode when config option is disabled', () => {
      setEmojiConfig({ unicodeEmoji: false });
      expect(emojify('Let it :bee:')).toEqual('Let it :bee:');
    });
  });

  describe('unemojify', () => {
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

    describe('unsupported characters', () => {
      const unsupported = '🪆';

      it('uses replacement character', () => {
        setEmojiConfig({ unicodeEmoji: false });
        expect(unemojify(unsupported)).toEqual('�');
      });
    });
  });

  describe('problem characters', () => {
    it.each(['🚀', '💎', '🧹', '📦'])('converts %s forth and back', (char) => {
      setEmojiConfig({ unicodeEmoji: false });
      const codified = unemojify(char);
      expect(codified).not.toEqual(char);

      setEmojiConfig({ unicodeEmoji: true });
      const emojified = emojify(codified);
      expect(emojified).toEqual(char);
    });
  });

  describe('stripEmojis', () => {
    const makeEmoji = (hexCode: string): string =>
      fromCodepointToUnicode(fromHexcodeToCodepoint(hexCode));

    it('is independent of config option', () => {
      const x: string = makeEmoji('26A0-FE0F');
      const y: string = makeEmoji('26A0');

      setEmojiConfig({ unicodeEmoji: true });
      expect(stripEmojis(`foo ${x} bar`)).toEqual(`foo ${y} bar`);

      setEmojiConfig({ unicodeEmoji: false });
      expect(stripEmojis(`foo ${x} bar`)).toEqual(`foo ${y} bar`);
    });
  });
});
