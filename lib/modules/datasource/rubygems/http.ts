import { Http } from '../../../util/http';
import { Throttle } from '../../../util/http/throttle';
import { parseUrl } from '../../../util/url';

export class RubygemsHttp extends Http {
  protected override getThrottle(url: string): Throttle | null {
    const host = parseUrl(url)?.host;

    if (host === 'rubygems.org') {
      const intervalMs = 100;
      return new Throttle(intervalMs);
    }

    return super.getThrottle(url);
  }
}
