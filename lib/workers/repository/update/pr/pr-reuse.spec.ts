import { DateTime } from 'luxon';
import { platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { tryReuseAutoclosedPr } from './pr-reuse';

describe('workers/repository/update/pr/pr-reuse', () => {
  const tryReuseFn = platform.tryReuseAutoclosedPr;

  afterEach(() => {
    Object.defineProperty(platform, 'tryReuseAutoclosedPr', {
      value: tryReuseFn,
      writable: true,
    });

    GlobalConfig.reset();
  });

  it('returns null if platform does not support PR reuse', async () => {
    Object.defineProperty(platform, 'tryReuseAutoclosedPr', {
      value: undefined,
      writable: true,
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
  });

  it('returns null if PR is not found', async () => {
    platform.findPr.mockResolvedValueOnce(null);

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
  });

  it('returns null if PR title does not seem to be autoclosed', async () => {
    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar',
      sourceBranch: 'some-branch',
      state: 'closed',
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
  });

  it('returns null if closedAt field is absent', async () => {
    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar - autoclosed',
      sourceBranch: 'some-branch',
      state: 'closed',
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
  });

  it('returns null if it was closed long time ago', async () => {
    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar - autoclosed',
      sourceBranch: 'some-branch',
      state: 'closed',
      closedAt: DateTime.now().minus({ weeks: 1, seconds: 1 }).toISO(),
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
  });

  it('returns null for dry-runs', async () => {
    GlobalConfig.set({ dryRun: true });

    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar - autoclosed',
      sourceBranch: 'some-branch',
      state: 'closed',
      closedAt: DateTime.now().minus({ hours: 1 }).toISO(),
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
    expect(tryReuseFn).not.toHaveBeenCalled();
  });

  it('returns updated Pr after successful reopen', async () => {
    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar - autoclosed',
      sourceBranch: 'some-branch',
      state: 'closed',
      closedAt: DateTime.now().minus({ hours: 1 }).toISO(),
    });

    tryReuseFn.mockResolvedValueOnce({
      number: 123,
      title: 'foobar',
      sourceBranch: 'some-branch',
      state: 'open',
    });

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toEqual({
      number: 123,
      title: 'foobar',
      sourceBranch: 'some-branch',
      state: 'open',
    });
    expect(tryReuseFn).toHaveBeenCalledOnce();
  });

  it('returns null if the retry throws', async () => {
    platform.findPr.mockResolvedValueOnce({
      number: 123,
      title: 'foobar - autoclosed',
      sourceBranch: 'some-branch',
      state: 'closed',
      closedAt: DateTime.now().minus({ hours: 1 }).toISO(),
    });

    tryReuseFn.mockRejectedValueOnce('oops');

    const res = await tryReuseAutoclosedPr('some-branch');

    expect(res).toBeNull();
    expect(tryReuseFn).toHaveBeenCalledOnce();
  });
});
