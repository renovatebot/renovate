import { HTMLElement, parse } from './html';

describe('util/html', () => {
  it('parses HTML', () => {
    const body = parse('<div>Hello, world!</div>');
    expect(body.childNodes).toHaveLength(1);
    const div = body.childNodes[0] as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.textContent).toBe('Hello, world!');
    expect(div instanceof HTMLElement).toBeTrue();
  });
  it('returns empty', () => {
    const body = parse('');
    expect(body.childNodes).toHaveLength(0);
  });
});
