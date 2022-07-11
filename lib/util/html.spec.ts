import * as parser from 'node-html-parser';
import { parse } from './html';

describe('util/html', () => {
  it('parses HTML', () => {
    const body = parse('<div>Hello, world!</div>');
    expect(body.childNodes).toHaveLength(1);
    const div = body.childNodes[0] as parser.HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.textContent).toBe('Hello, world!');
    expect(div instanceof parser.HTMLElement).toBeTrue();
  });

  it('returns empty', () => {
    const body = parse('');
    expect(body.childNodes).toHaveLength(0);
  });

  it('parses HTML: PRE block hides child nodes', () => {
    const body = parse('<div>Hello, world!</div>\n<pre><a>node A</a></pre>');
    const childNodesA = body.querySelectorAll('a');
    expect(childNodesA).toHaveLength(0);
  });

  it('parses HTML: use additional options to discover child nodes on PRE blocks', () => {
    const body = parse('<div>Hello, world!</div>\n<pre><a>node A</a></pre>', {
      blockTextElements: {},
    });
    const childNodesA = body.querySelectorAll('a');
    expect(childNodesA).toHaveLength(1);
    const div = childNodesA[0];
    expect(div.tagName).toBe('A');
    expect(div.textContent).toBe('node A');
    expect(div instanceof parser.HTMLElement).toBe(true);
  });
});
