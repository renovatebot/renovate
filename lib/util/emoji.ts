import emoji from 'node-emoji';
import { RenovateConfig } from '../config';
import { addInitializationCallback } from '../workers/global/initialize';

let unicodeEmoji = false;

export function setEmojiConfig(_config: RenovateConfig): void {
  unicodeEmoji = _config.unicodeEmoji;
}

export function emojify(text: string): string {
  return unicodeEmoji ? emoji.emojify(text) : text;
}

addInitializationCallback(setEmojiConfig);
