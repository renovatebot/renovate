import { logger } from '../../../test/util';
import * as tracker from './tracker';

describe('util/http/tracker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    tracker.reset();
  });

  it('does not track without init', () => {
    tracker.track('https://foo.com/foo');
    tracker.track('https://bar.com/bar');
    tracker.track('https://bar.com/bar');
    tracker.untrack('https://bar.com/bar');
    tracker.reset();
    tracker.init();
    tracker.track('https://baz.com/baz');
    tracker.reset();

    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        pendingRequests: {
          'https://baz.com/baz (GET)': 1,
        },
      },
      'Unfinished HTTP requests'
    );
  });

  it('tracks unhandled requests', () => {
    tracker.init();
    tracker.track('https://foo.com/foo');
    tracker.track('https://bar.com/bar');
    tracker.track('https://bar.com/bar');
    tracker.track('https://baz.com/baz');
    tracker.track('https://baz.com/baz');
    tracker.track('https://baz.com/baz');
    tracker.reset();

    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        pendingRequests: {
          'https://foo.com/foo (GET)': 1,
          'https://bar.com/bar (GET)': 2,
          'https://baz.com/baz (GET)': 3,
        },
      },
      'Unfinished HTTP requests'
    );
  });

  it('untracks handled requests', () => {
    tracker.init();

    tracker.track('https://foo.com/foo');
    tracker.track('https://bar.com/bar');
    tracker.track('https://bar.com/bar');
    tracker.track('https://baz.com/baz');
    tracker.track('https://baz.com/baz');
    tracker.track('https://baz.com/baz');

    tracker.untrack('https://foo.com/foo');
    tracker.untrack('https://bar.com/bar');
    tracker.untrack('https://baz.com/baz');

    tracker.reset();

    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        pendingRequests: {
          'https://bar.com/bar (GET)': 1,
          'https://baz.com/baz (GET)': 2,
        },
      },
      'Unfinished HTTP requests'
    );
  });

  it('handles untrack edge-case', () => {
    tracker.init();
    tracker.untrack('https://example.com');
    tracker.reset();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });
});
