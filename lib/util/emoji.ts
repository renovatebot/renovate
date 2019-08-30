import emoji from 'node-emoji';
import { RenovateConfig } from '../config';

export function emojify(text: string, config: RenovateConfig): string {
  return config.unicodeEmoji ? emoji.emojify(text) : text;
}
