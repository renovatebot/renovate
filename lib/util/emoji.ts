import is from '@sindresorhus/is';
import mathiasBynensEmojiRegex from 'emoji-regex';
import {
  fromCodepointToUnicode,
  fromHexcodeToCodepoint,
  fromUnicodeToHexcode,
} from 'emojibase';
import emojibaseEmojiRegex from 'emojibase-regex/emoji.js';
import SHORTCODE_REGEX from 'emojibase-regex/shortcode.js';
import { z } from 'zod';
import type { RenovateConfig } from '../config/types';
import dataFiles from '../data-files.generated';
import { logger } from '../logger';
import { regEx } from './regex';
import { Json } from './schema-utils';

let unicodeEmoji = true;

let mappingsInitialized = false;
const shortCodesByHex = new Map<string, string>();
const hexCodesByShort = new Map<string, string>();

const EmojiShortcodesSchema = Json.pipe(
  z.record(z.string(), z.union([z.string(), z.array(z.string())])),
);

function lazyInitMappings(): void {
  if (!mappingsInitialized) {
    const result = EmojiShortcodesSchema.safeParse(
      dataFiles.get('node_modules/emojibase-data/en/shortcodes/github.json')!,
    );
    // istanbul ignore if: not easily testable
    if (!result.success) {
      logger.warn({ error: result.error }, 'Unable to parse emoji shortcodes');
      return;
    }
    for (const [hex, val] of Object.entries(result.data)) {
      const shortCodes = is.array(val) ? val : [val];
      shortCodesByHex.set(hex, `:${shortCodes[0]}:`);
      shortCodes.forEach((shortCode) => {
        hexCodesByShort.set(`:${shortCode}:`, hex);
      });
    }
    mappingsInitialized = true;
  }
}

export function setEmojiConfig(config: RenovateConfig): void {
  unicodeEmoji = !!config.unicodeEmoji;
}

const shortCodeRegex = regEx(SHORTCODE_REGEX.source, 'g');

export function emojify(text: string): string {
  if (!unicodeEmoji) {
    return text;
  }
  lazyInitMappings();
  return text.replace(shortCodeRegex, (shortCode) => {
    const hexCode = hexCodesByShort.get(shortCode);
    return hexCode
      ? fromCodepointToUnicode(fromHexcodeToCodepoint(hexCode))
      : shortCode;
  });
}

const emojiRegexSrc = [emojibaseEmojiRegex, mathiasBynensEmojiRegex()].map(
  ({ source }) => source,
);
const emojiRegex = new RegExp(`(?:${emojiRegexSrc.join('|')})`, 'g'); // TODO #12875 cannot figure it out
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

export function unemojify(text: string): string {
  if (unicodeEmoji) {
    return text;
  }
  lazyInitMappings();
  return text.replace(emojiRegex, (emoji) => {
    const hexCode = stripHexCode(fromUnicodeToHexcode(emoji));
    const shortCode = shortCodesByHex.get(hexCode);
    return shortCode ?? '�';
  });
}

function stripEmoji(emoji: string): string {
  const hexCode = stripHexCode(fromUnicodeToHexcode(emoji));
  // `hexCode` could be empty if `emoji` is a modifier character that isn't
  // modifying anything
  if (hexCode) {
    const codePoint = fromHexcodeToCodepoint(hexCode);
    return fromCodepointToUnicode(codePoint);
  }
  return '';
}

export function stripEmojis(input: string): string {
  return input.replace(emojiRegex, stripEmoji);
}
