import emoji from 'node-emoji';
import { RenovateConfig } from '../config';

let unicodeEmoji = false;

export function setEmojiConfig(_config: RenovateConfig) {
  unicodeEmoji = _config.unicodeEmoji;
}

export function emojify(text: string): string {
  return unicodeEmoji ? emoji.emojify(text) : text;
}
