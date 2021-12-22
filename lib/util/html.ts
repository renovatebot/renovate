import type { HTMLElement, Options } from 'node-html-parser';
import * as parser from 'node-html-parser';

export type { HTMLElement, Options };

export function parse(html: string, config?: Partial<Options>): HTMLElement {
  if (typeof config !== 'undefined') {
    return parser.parse(html, config);
  }

  return parser.parse(html);
}
