import { getName } from '../../test/util';
import { setEmojiConfig, unemojify } from './emoji';

describe(getName(__filename), () => {
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
});
