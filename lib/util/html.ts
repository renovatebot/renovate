import { JSDOM } from 'jsdom';

export function parse(html: string): HTMLElement {
  return new JSDOM(html).window.document.body;
}
