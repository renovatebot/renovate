import { Http } from '../../../util/http';
import { Throttle } from '../../../util/http/throttle';
import { parseUrl } from '../../../util/url';

export class RubygemsHttp extends Http {
  protected override getThrottle(url: string): Throttle | null {
    const host = parseUrl(url)?.host;

    if (host === 'rubygems.org') {
      // rubygems.org has a rate limit of 10 per second, so we use a more conservative 8
      // See: https://guides.rubygems.org/rubygems-org-rate-limits/
      const intervalMs = 125;
      return new Throttle(intervalMs);
    }

    return super.getThrottle(url);
  }
}
