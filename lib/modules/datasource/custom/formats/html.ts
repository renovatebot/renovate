import is from '@sindresorhus/is';
import { readLocalFile } from '../../../../util/fs';
import { parse } from '../../../../util/html';
import type { Http } from '../../../../util/http';
import type { ReleaseResult } from '../../types';
import type { CustomDatasourceFetcher } from './types';

function extractLinks(content: string): ReleaseResult {
  const body = parse(content);

  // node-html-parser doesn't parse anything inside <pre>
  // but, for example, nginx wraps directory listings in <pre>
  const pres = body
    .getElementsByTagName('pre')
    .map((pre) => parse(pre.textContent));

  const links = [body, ...pres].flatMap((e) => e.getElementsByTagName('a'));
  const hrefs = links
    .map((node) => node.getAttribute('href'))
    .filter(is.truthy);

  const releases = hrefs.map((href) => {
    return {
      version: href,
    };
  });

  return { releases };
}

export class HtmlFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.get(registryURL, {
      headers: {
        Accept: 'text/html',
      },
    });

    return extractLinks(response.body);
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return fileContent ? extractLinks(fileContent) : null;
  }
}
