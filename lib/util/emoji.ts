import is from '@sindresorhus/is';
import mathiasBynensEmojiRegex from 'emoji-regex';
import {
  fromCodepointToUnicode,
  fromHexcodeToCodepoint,
  fromUnicodeToHexcode,
} from 'emojibase';
import emojibaseEmojiRegex from 'emojibase-regex/emoji';
import SHORTCODE_REGEX from 'emojibase-regex/shortcode';
import type { RenovateConfig } from '../config/types';
import dataFiles from '../data-files.generated';
import { regEx } from './regex';

const githubShortcodes: Record<string, string | string[]> = JSON.parse(
  dataFiles.get('emojibase-github-shortcodes.json')
);

let unicodeEmoji = true;

let mappingsInitialized = false;
const shortCodesByHex = new Map<string, string>();
const hexCodesByShort = new Map<string, string>();

function lazyInitMappings(): void {
  if (!mappingsInitialized) {
    for (const [hex, val] of Object.entries(githubShortcodes)) {
      const shortcodes: string[] = is.array<string>(val) ? val : [val];
      shortCodesByHex.set(hex, `:${shortcodes[0]}:`);
      shortcodes.forEach((shortcode) => {
        hexCodesByShort.set(`:${shortcode}:`, hex);
      });
    }
    mappingsInitialized = true;
  }
}

export function setEmojiConfig(_config: RenovateConfig): void {
  unicodeEmoji = _config.unicodeEmoji;
}

const shortcodeRegex = regEx(SHORTCODE_REGEX.source, 'g');

export function emojify(text: string): string {
  lazyInitMappings();
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
const excludedModifiers = new Set([
  '20E3',
  '200D',
  'FE0E',
  'FE0F',
  '1F3FB',
  '1F3FC',
  '1F3FD',
  '1F3FE',
  '1F3FF',
  '1F9B0',
  '1F9B1',
  '1F9B2',
  '1F9B3',
]);

export function stripHexCode(input: string): string {
  return input
    .split('-')
    .filter((modifier) => !excludedModifiers.has(modifier))
    .join('-');
}

export function unemojify(text: string, tofu = '�'): string {
  lazyInitMappings();
  return unicodeEmoji
    ? text
    : text.replace(emojiRegex, (emoji) => {
        const hex = stripHexCode(fromUnicodeToHexcode(emoji));
        const shortCode = shortCodesByHex.get(hex);
        return shortCode || tofu;
      });
}
