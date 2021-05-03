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

let unicodeEmoji = true;

const table: Record<string, string | string[]> = JSON.parse(
  dataFiles.get('emojibase-github-shortcodes.json')
);

let mappingsInitialized = false;
const shortCodesByHex = new Map<string, string>();
const hexCodesByShort = new Map<string, string>();

function lazyInitMappings(): void {
  if (!mappingsInitialized) {
    for (const [hex, val] of Object.entries(table)) {
      const shortCodes: string[] = is.array<string>(val) ? val : [val];
      shortCodesByHex.set(hex, `:${shortCodes[0]}:`);
      shortCodes.forEach((shortCode) => {
        hexCodesByShort.set(`:${shortCode}:`, hex);
      });
    }
    mappingsInitialized = true;
  }
}

export function setEmojiConfig(_config: RenovateConfig): void {
  unicodeEmoji = _config.unicodeEmoji;
}

const shortCodeRegex = regEx(SHORTCODE_REGEX.source, 'g');

export function emojify(text: string): string {
  lazyInitMappings();
  return unicodeEmoji
    ? text.replace(shortCodeRegex, (shortCode) => {
        const hexCode = hexCodesByShort.get(shortCode);
        return hexCode
          ? fromCodepointToUnicode(fromHexcodeToCodepoint(hexCode))
          : shortCode;
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
        const hexCode = stripHexCode(fromUnicodeToHexcode(emoji));
        const shortCode = shortCodesByHex.get(hexCode);
        return shortCode || tofu;
      });
}

function stripEmoji(emoji: string): string {
  const hexCode = stripHexCode(fromUnicodeToHexcode(emoji));
  const codePoint = fromHexcodeToCodepoint(hexCode);
  const result = fromCodepointToUnicode(codePoint);
  return result;
}

export function stripEmojis(input: string): string {
  return input.replace(emojiRegex, stripEmoji);
}
