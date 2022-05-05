import * as httpMock from '../../../test/http-mock';
import * as memCache from '../cache/memory';
import * as hostRules from '../host-rules';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '.';

describe('util/merge-confidence/index', () => {
  describe('isActiveConfidenceLevel()', () => {
    it('returns false if null', () => {
      expect(isActiveConfidenceLevel(null)).toBeFalse();
    });

    it('returns false if low', () => {
      expect(isActiveConfidenceLevel('low')).toBeFalse();
    });

    it('returns false if nonsense', () => {
      expect(isActiveConfidenceLevel('nonsense')).toBeFalse();
    });

    it('returns true if valid value (high)', () => {
      expect(isActiveConfidenceLevel('high')).toBeTrue();
    });
  });

  describe('satisfiesConfidenceLevel()', () => {
    it('returns false if less', () => {
      expect(satisfiesConfidenceLevel('low', 'high')).toBeFalse();
    });

    it('returns true if equal', () => {
      expect(satisfiesConfidenceLevel('high', 'high')).toBeTrue();
    });

    it('returns true if more', () => {
      expect(satisfiesConfidenceLevel('very high', 'high')).toBeTrue();
    });
  });

  describe('getMergeConfidenceLevel()', () => {
    beforeEach(() => {
      hostRules.clear();
      memCache.reset();
    });

    it('returns neutral if undefined updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.0',
          '25.0.0',
          undefined
        )
      ).toBe('neutral');
    });

    it('returns neutral if irrelevant updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.1.0',
          '25.0.0',
          'bump'
        )
      ).toBe('neutral');
    });

    it('returns high if pinning', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.1',
          '25.0.1',
          'pin'
        )
      ).toBe('high');
    });

    it('returns neutral if no token', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.2.0',
          '25.0.0',
          'major'
        )
      ).toBe('neutral');
    });

    it('returns valid confidence level', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '24.3.0';
      const newVersion = '25.0.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { confidence: 'high' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'major'
        )
      ).toBe('high');
    });

    it('returns neutral if invalid confidence level', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.1.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { nope: 'nope' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
    });

    it('returns neutral if exception from API', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.4.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(403);
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');

      // FIXME: no cache hit
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}-new/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(403);
      // memory cache
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName + '-new',
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
    });

    it('returns high if pinning digest', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.1',
          '25.0.1',
          'pinDigest'
        )
      ).toBe('high');
    });
  });
});
