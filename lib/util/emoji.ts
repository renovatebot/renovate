import is from '@sindresorhus/is';
import mathiasBynensEmojiRegex from 'emoji-regex';
import {
  fromCodepointToUnicode,
  fromHexcodeToCodepoint,
  fromUnicodeToHexcode,
} from 'emojibase';
import githubShortcodes from 'emojibase-data/en/shortcodes/github.json';
import emojibaseEmojiRegex from 'emojibase-regex/emoji';
import SHORTCODE_REGEX from 'emojibase-regex/shortcode';
import type { RenovateConfig } from '../config/types';
import { regEx } from './regex';

let unicodeEmoji = false;

const shortCodesByHex = new Map<string, string>();
const hexCodesByShort = new Map<string, string>();

function initMappings(): void {
  if (shortCodesByHex.size === 0 && shortCodesByHex.size === 0) {
    for (const [hex, val] of Object.entries(githubShortcodes)) {
      const shortcodes: string[] = is.array<string>(val) ? val : [val];
      shortCodesByHex.set(hex, `:${shortcodes[0]}:`);
      shortcodes.forEach((shortcode) => {
        hexCodesByShort.set(`:${shortcode}:`, hex);
      });
    }
  }
}

export function setEmojiConfig(_config: RenovateConfig): void {
  initMappings();
  unicodeEmoji = _config.unicodeEmoji;
}

const shortcodeRegex = regEx(SHORTCODE_REGEX.source, 'g');

export function emojify(text: string): string {
  return unicodeEmoji
    ? text.replace(shortcodeRegex, (shortcode) => {
        const hexCode = hexCodesByShort.get(shortcode);
        return hexCode
          ? fromCodepointToUnicode(fromHexcodeToCodepoint(hexCode))
          : shortcode;
      })
    : text;
}

const emojiRegexSrc = [emojibaseEmojiRegex, mathiasBynensEmojiRegex()].map(
  ({ source }) => source
);
const emojiRegex = new RegExp(`(?:${emojiRegexSrc.join('|')})`, 'g');

export function unemojify(text: string, tofu = '�'): string {
  return unicodeEmoji
    ? text
    : text.replace(emojiRegex, (emoji) => {
        const hex = fromUnicodeToHexcode(emoji);
        const shortCode = shortCodesByHex.get(hex);
        return shortCode || tofu;
      });
}
