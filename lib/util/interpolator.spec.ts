import { options } from '../config/secrets';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
} from '../constants/error-messages';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from './interpolator';

describe('util/interpolator', () => {
  describe('validateInterpolatedValues', () => {
    it('does nothing if not input', () => {
      expect(() =>
        validateInterpolatedValues(undefined, options.secrets),
      ).not.toThrow();
    });

    it('does not throw error when keys and values are valid', () => {
      expect(() =>
        validateInterpolatedValues({ SOME_SECRET: 'secret' }, options.secrets),
      ).not.toThrow();
    });

    it('throws when input is not a valid object', () => {
      expect(() =>
        validateInterpolatedValues('not_an_object', options.secrets),
      ).toThrow(CONFIG_SECRETS_INVALID);
    });

    it('throws when keys do not follow specified regex patterns', () => {
      expect(() =>
        validateInterpolatedValues(
          { 'SOME-SECRET': 'secret' },
          options.secrets,
        ),
      ).toThrow(CONFIG_SECRETS_INVALID);
    });

    it('throws when values are not of type string', () => {
      expect(() =>
        validateInterpolatedValues({ SOME_SECRET: 1 }, options.secrets),
      ).toThrow(CONFIG_SECRETS_INVALID);
    });
  });

  describe('replaceInterpolatedValuesInObject', () => {
    it('replaces values and deletes secrets', () => {
      const secrets = {
        SECRET_HOST: 'host',
        SECRET_MODE: 'silent',
        SECRET_LABEL: 'secret',
        SECRET_PACKAGE: 'package',
      };
      const res = replaceInterpolatedValuesInObject(
        {
          mode: '{{ secrets.SECRET_MODE }}',
          labels: ['{{ secrets.SECRET_LABEL }}', 'renovate'],
          prBodyDefinitions: {
            Package: '{{ secrets.SECRET_PACKAGE }}',
            Type: 'peer',
          },
          productLinks: {
            documentation: 'https://docs.renovatebot.com/',
          },
          hostRules: [
            {
              matchHost: '{{ secrets.SECRET_HOST }}',
            },
          ],
          secrets,
        },
        secrets,
        options.secrets,
        true,
      );

      expect(res).toEqual({
        mode: 'silent',
        labels: ['secret', 'renovate'],
        prBodyDefinitions: {
          Package: 'package',
          Type: 'peer',
        },
        productLinks: {
          documentation: 'https://docs.renovatebot.com/',
        },
        hostRules: [
          {
            matchHost: 'host',
          },
        ],
      });
    });

    it('replaces values and keeps secrets', () => {
      const res = replaceInterpolatedValuesInObject(
        {
          mode: '{{ secrets.SECRET_MODE }}',
          secrets: { SECRET_MODE: 'silent' },
        },
        { SECRET_MODE: 'silent' },
        options.secrets,
        false,
      );

      expect(res).toEqual({
        mode: 'silent',
        secrets: { SECRET_MODE: 'silent' },
      });
    });

    it('throws error if secrets are used in disallowed options', () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationError = `Disallowed secrets substitution`;
      error.validationMessage =
        'The field `prHeader` may not use secrets substitution';

      expect(() =>
        replaceInterpolatedValuesInObject(
          {
            prHeader: '{{ secrets.SECRET_HEADER }}',
            secrets: { SECRET_HEADER: 'header' },
          },
          { SECRET_HEADER: 'header' },
          options.secrets,
          false,
        ),
      ).toThrow(error);
    });

    it('throws error if secret key is not present in config', () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationError = `Unknown secrets name`;
      error.validationMessage =
        'The following secrets name was not found in config: SECRET_MODE';

      expect(() =>
        replaceInterpolatedValuesInObject(
          {
            mode: '{{ secrets.SECRET_MODE }}',
            secrets: { SECRET_NOT_MODE: 'silent' },
          },
          { SECRET_NOT_MODE: 'silent' },
          options.secrets,
          false,
        ),
      ).toThrow(error);
    });
  });
});
