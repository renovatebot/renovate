import { Fixtures } from '../../test/fixtures';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { decryptConfig } from './decrypt';
import { GlobalConfig } from './global';
import type { RenovateConfig } from './types';

const privateKey = Fixtures.get('private.pem');
const privateKeyPgp = Fixtures.get('private-pgp.pem');
const repository = 'abc/def';

describe('config/decrypt', () => {
  describe('decryptConfig()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = {};
      GlobalConfig.reset();
    });

    it('returns empty with no privateKey', async () => {
      delete config.encrypted;
      const res = await decryptConfig(config, repository);
      expect(res).toMatchObject(config);
    });

    it('warns if no privateKey found', async () => {
      config.encrypted = { a: '1' };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.a).toBeUndefined();
    });

    it('handles invalid encrypted type', async () => {
      config.encrypted = 1;
      GlobalConfig.set({ privateKey });
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
    });

    it('handles invalid encrypted value', async () => {
      config.encrypted = { a: 1 };
      GlobalConfig.set({ privateKey, privateKeyOld: 'invalid-key' });
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('replaces npm token placeholder in npmrc', async () => {
      GlobalConfig.set({
        privateKey: 'invalid-key',
        privateKeyOld: privateKey,
      }); // test old key failover
      config.npmrc =
        '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n';
      config.encrypted = {
        npmToken:
          'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.npmToken).toBeUndefined();
      expect(res.npmrc).toBe(
        '//registry.npmjs.org/:_authToken=abcdef-ghijklm-nopqf-stuvwxyz\n//registry.npmjs.org/:_authToken=abcdef-ghijklm-nopqf-stuvwxyz\n',
      );
    });

    it('appends npm token in npmrc', async () => {
      GlobalConfig.set({ privateKey });
      config.npmrc = 'foo=bar\n';
      config.encrypted = {
        npmToken:
          'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.npmToken).toBeUndefined();
      expect(res.npmrc).toMatchSnapshot();
    });

    it('decrypts nested', async () => {
      GlobalConfig.set({ privateKey });
      config.packageFiles = [
        {
          packageFile: 'package.json',
          devDependencies: {
            encrypted: {
              branchPrefix:
                'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
              npmToken:
                'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
            },
          },
        },
        'backend/package.json',
      ];
      // TODO: fix types #22198
      const res = (await decryptConfig(config, repository)) as any;
      expect(res.encrypted).toBeUndefined();
      expect(res.packageFiles[0].devDependencies.encrypted).toBeUndefined();
      expect(res.packageFiles[0].devDependencies.branchPrefix).toBe(
        'abcdef-ghijklm-nopqf-stuvwxyz',
      );
      expect(res.packageFiles[0].devDependencies.npmToken).toBeUndefined();
      expect(res.packageFiles[0].devDependencies.npmrc).toBe(
        '//registry.npmjs.org/:_authToken=abcdef-ghijklm-nopqf-stuvwxyz\n',
      );
    });

    it('rejects invalid PGP message', async () => {
      GlobalConfig.set({ privateKey: privateKeyPgp });
      config.encrypted = {
        token:
          'long-but-wrong-wcFMAw+4H7SgaqGOAQ//ZNPgHJ4RQBdfFoDX8Ywe9UxqMlc8k6VasCszQ2JULh/BpEdKdgRUGNaKaeZ+oBKYDBmDwAD5V5FEMlsg+KO2gykp/p2BAwvKGtYK0MtxLh4h9yJbN7TrVnGO3/cC+Inp8exQt0gD6f1Qo/9yQ9NE4/BIbaSs2b2DgeIK7Ed8N675AuSo73UOa6o7t+9pKeAAK5TQwgSvolihbUs8zjnScrLZD+nhvL3y5gpAqK9y//a+bTu6xPA1jdLjsswoCUq/lfVeVsB2GWV2h6eex/0fRKgN7xxNgdMn0a7msrvumhTawP8mPisPY2AAsHRIgQ9vdU5HbOPdGoIwI9n9rMdIRn9Dy7/gcX9Ic+RP2WwS/KnPHLu/CveY4W5bYqYoikWtJs9HsBCyWFiHIRrJF+FnXwtKdoptRfxTfJIkBoLrV6fDIyKo79iL+xxzgrzWs77KEJUJfexZBEGBCnrV2o7mo3SU197S0qx7HNvqrmeCj8CLxq8opXC71TNa+XE6BQUVyhMFxtW9LNxZUHRiNzrTSikArT4hzjyr3f9cb0kZVcs6XJQsm1EskU3WXo7ETD7nsukS9GfbwMn7tfYidB/yHSHl09ih871BcgByDmEKKdmamcNilW2bmTAqB5JmtaYT5/H8jRQWo/VGrEqlmiA4KmwSv7SZPlDnaDFrmzmMZZDSRgHe5KWl283XLmSeE8J0NPqwFH3PeOv4fIbOjJrnbnFBwSAsgsMe2K4OyFDh2COfrho7s8EP1Kl5lBkYJ+VRreGRerdSu24',
      };
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      config.encrypted = {
        // Missing value
        token:
          'wcFMAw+4H7SgaqGOAQ//ZNPgHJ4RQBdfFoDX8Ywe9UxqMlc8k6VasCszQ2JULh/BpEdKdgRUGNaKaeZ+oBKYDBmDwAD5V5FEMlsg+KO2gykp/p2BAwvKGtYK0MtxLh4h9yJbN7TrVnGO3/cC+Inp8exQt0gD6f1Qo/9yQ9NE4/BIbaSs2b2DgeIK7Ed8N675AuSo73UOa6o7t+9pKeAAK5TQwgSvolihbUs8zjnScrLZD+nhvL3y5gpAqK9y//a+bTu6xPA1jdLjsswoCUq/lfVeVsB2GWV2h6eex/0fRKgN7xxNgdMn0a7msrvumhTawP8mPisPY2AAsHRIgQ9vdU5HbOPdGoIwI9n9rMdIRn9Dy7/gcX9Ic+RP2WwS/KnPHLu/CveY4W5bYqYoikWtJs9HsBCyWFiHIRrJF+FnXwtKdoptRfxTfJIkBoLrV6fDIyKo79iL+xxzgrzWs77KEJUJfexZBEGBCnrV2o7mo3SU197S0qx7HNvqrmeCj8CLxq8opXC71TNa+XE6BQUVyhMFxtW9LNxZUHRiNzrTSikArT4hzjyr3f9cb0kZVcs6XJQsm1EskU3WXo7ETD7nsukS9GfbwMn7tfYidB/yHSHl09ih871BcgByDmEKKdmamcNilW2bmTAqB5JmtaYT5/H8jRQWo/VGrEqlmiA4KmwSv7SZPlDnaDFrmzmMZZDSRgHe5KWl283XLmSeE8J0NPqwFH3PeOv4fIbOjJrnbnFBwSAsgsMe2K4OyFDh2COfrho7s8EP1Kl5lBkYJ+VRreGRerdSu24',
      };
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      config.encrypted = {
        // Missing org scope
        token:
          'wcFMAw+4H7SgaqGOAQ//W38A3PmaZnE9XTCHGDQFD52Kz78UYnaiYeAT13cEqYWTwEvQ57B7D7I6i4jCLe7KwkUCS90kyoqd7twD75W/sO70MyIveKnMlqqnpkagQkFgmzMaXXNHaJXEkjzsflTELZu6UsUs/kZYmab7r14YLl9HbH/pqN9exil/9s3ym9URCPOyw/l04KWntdMAy0D+c5M4mE+obv6fz6nDb8tkdeT5Rt2uU+qw3gH1OsB2yu+zTWpI/xTGwDt5nB5txnNTsVrQ/ZK85MSktacGVcYuU9hsEDmSrShmtqlg6Myq+Hjb7cYAp2g4n13C/I3gGGaczl0PZaHD7ALMjI7p6O1q+Ix7vMxipiKMVjS3omJoqBCz3FKc6DVhyX4tfhxgLxFo0DpixNwGbBRbMBO8qZfUk7bicAl/oCRc2Ijmay5DDYuvtkw3G3Ou+sZTe6DNpWUFy6VA4ai7hhcLvcAuiYmLdwPISRR/X4ePa8ZrmSVPyVOvbmmwLhcDYSDlC9Mw4++7ELomlve5kvjVSHvPv9BPVb5sJF7gX4vOT4FrcKalQRPmhNCZrE8tY2lvlrXwV2EEhya8EYv4QTd3JUYEYW5FXiJrORK5KDTnISw+U02nFZjFlnoz9+R6h+aIT1crS3/+YjCHE/EIKvSftOnieYb02Gk7M9nqU19EYL9ApYw4+IjSRgFM3DShIrvuDwDkAwUfaq8mKtr9Vjg/r+yox//GKS3u3r4I3+dfCljA3OwskTPfbSD+huBk4mylIvaL5v8Fngxo979wiLw',
      };
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      config.encrypted = {
        // Impossible to parse
        token:
          'wcFMAw+4H7SgaqGOAQ//Wa/gHgQdH7tj3LQdW6rWKjzmkYVKZW9EbexJExu4WLaMgEKodlRMilcqCKfQZpjzoiC31J8Ly/x6Soury+lQnLVbtIQ4KWa/uCIz4lXCpPpGNgN2jPfOmdwWBMOcXIT+BgAMxRu3rAmvTtunrkACJ3J92eYNwJhTzp2Azn9LpT7kHnZ64z2SPhbdUgMMhCBwBG5BPArPzF5fdaqa8uUSbKhY0GMiqPXq6Zeq+EBNoPc/RJp2urpYTknO+nRb39avKjihd9MCZ/1d3QYymbRj7SZC3LJhenVF0hil3Uk8TBASnGQiDmBcIXQFhJ0cxavXqKjx+AEALq+kTdwGu5vuE2+2B820/o3lAXR9OnJHr8GodJ2ZBpzOaPrQe5zvxL0gLEeUUPatSOwuLhdo/6+bRCl2wNz23jIjDEFFTmsLqfEHcdVYVTH2QqvLjnUYcCRRuM32vS4rCMOEe0l6p0CV2rk22UZDIPcxqXjKucxse2Sow8ATWiPoIw7zWj7XBLqUKHFnMpPV2dCIKFKBsOKYgLjF4BvKzZJyhmVEPgMcKQLYqeT/2uWDR77NSWH0Cyiwk9M3KbOIMmV3pWh9PiXk6CvumECELbJHYH0Mc+P//BnbDq2Ie9dHdmKhFgRyHU7gWvkPhic9BX36xyldPcnhTgr1XWRoVe0ETGLDPCcqrQ/SUQGrLiujSOgxGu2K/6LDJhi4IKz1/nf7FUSj5eTIDqQiSPP5pXDjlH7oYxXXrHI/aYOCZ5sBx7mOzlEcENIrYblCHO/CYMTWdCJ4Wrftqk7K/A=',
      };
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      config.encrypted = {
        token: 'too-short',
      };
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('handles PGP org constraint', async () => {
      GlobalConfig.set({ privateKey: privateKeyPgp });
      config.encrypted = {
        token:
          'wcFMAw+4H7SgaqGOAQ/+Lz6RlbEymbnmMhrktuaGiDPWRNPEQFuMRwwYM6/B/r0JMZa9tskAA5RpyYKxGmJJeuRtlA8GkTw02GoZomlJf/KXJZ95FwSbkXMSRJRD8LJ2402Hw2TaOTaSvfamESnm8zhNo8cok627nkKQkyrpk64heVlU5LIbO2+UgYgbiSQjuXZiW+QuJ1hVRjx011FQgEYc59+22yuKYqd8rrni7TrVqhGRlHCAqvNAGjBI4H7uTFh0sP4auunT/JjxTeTkJoNu8KgS/LdrvISpO67TkQziZo9XD5FOzSN7N3e4f8vO4N4fpjgkIDH/9wyEYe0zYz34xMAFlnhZzqrHycRqzBJuMxGqlFQcKWp9IisLMoVJhLrnvbDLuwwcjeqYkhvODjSs7UDKwTE4X4WmvZr0x4kOclOeAAz/pM6oNVnjgWJd9SnYtoa67bZVkne0k6mYjVhosie8v8icijmJ4OyLZUGWnjZCRd/TPkzQUw+B0yvsop9FYGidhCI+4MVx6W5w7SRtCctxVfCjLpmU4kWaBUUJ5YIQ5xm55yxEYuAsQkxOAYDCMFlV8ntWStYwIG1FsBgJX6VPevXuPPMjWiPNedIpJwBH2PLB4blxMfzDYuCeaIqU4daDaEWxxpuFTTK9fLdJKuipwFG6rwE3OuijeSN+2SLszi834DXtUjQdikHSTQG392+oTmZCFPeffLk/OiV2VpdXF3gGL7sr5M9hOWIZ783q0vW1l6nAElZ7UA//kW+L6QRxbnBVTJK5eCmMY6RJmL76zjqC1jQ0FC10',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      await expect(decryptConfig(config, 'wrong/org')).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('handles PGP multi-org constraint', async () => {
      GlobalConfig.set({ privateKey: privateKeyPgp });
      config.encrypted = {
        token:
          'wcFMAw+4H7SgaqGOAQ//Yk4RTQoLEhO0TKxN2IUBrCi88ts+CG1SXKeL06sJ2qikN/3n2JYAGGKgkHRICfu5dOnsjyFdLJ1XWUrbsM3XgVWikMbrmzD1Xe7N5DsoZXlt4Wa9pZ+IkZuE6XcKKu9whIJ22ciEwCzFwDmk/CBshdCCVVQ3IYuM6uibEHn/AHQ8K15XhraiSzF6DbJpevs5Cy7b5YHFyE936H25CVnouUQnMPsirpQq3pYeMq/oOtV/m4mfRUUQ7MUxvtrwE4lq4hLjFu5n9rwlcqaFPl7I7BEM++1c9LFpYsP5mTS7hHCZ9wXBqER8fa3fKYx0bK1ihCpjP4zUkR7P/uhWDArXamv7gHX2Kj/Qsbegn7KjTdZlggAmaJl/CuSgCbhySy+E55g3Z1QFajiLRpQ5+RsWFDbbI08YEgzyQ0yNCaRvrkgo7kZ1D95rEGRfY96duOQbjzOEqtvYmFChdemZ2+f9Kh/JH1+X9ynxY/zYe/0p/U7WD3QNTYN18loc4aXiB1adXD5Ka2QfNroLudQBmLaJpJB6wASFfuxddsD5yRnO32NSdRaqIWC1x6ti3ZYJZ2RsNwJExPDzjpQTuMOH2jtpu3q7NHmW3snRKy2YAL2UjI0YdeKIlhc/qLCJt9MRcOxWYvujTMD/yGprhG44qf0jjMkJBu7NjuVIMONujabl9b7SUQGfO/t+3rMuC68bQdCGLlO8gf3hvtD99utzXphi6idjC0HKSW/9KzuMkm+syGmIAYq/0L3EFvpZ38uq7z8KzwFFQHI3sBA34bNEr5zpU5OMWg',
      };
      let res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      res = await decryptConfig(config, 'def/ghi');
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      await expect(decryptConfig(config, 'wrong/org')).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('handles PGP org/repo constraint', async () => {
      GlobalConfig.set({ privateKey: privateKeyPgp });
      config.encrypted = {
        token:
          'wcFMAw+4H7SgaqGOAQ//Wp7N0PaDZp0uOdwsc1CuqAq0UPcq+IQdHyKpJs3tHiCecXBHogy4P+rY9nGaUrVneCr4HexuKGuyJf1yl0ZqFffAUac5PjF8eDvjukQGOUq4aBlOogJCEefnuuVxVJx+NRR5iF1P6v57bmI1c+zoqZI/EQB30KU6O1BsdGPLUA/+R3dwCZd5Mbd36s34eYBasqcY9/QbqFcpElXMEPMse3kMCsVXPbZ+UMjtPJiBPUmtJq+ifnu1LzDrfshusSQMwgd/QNk7nEsijiYKllkWhHTP6g7zigvJ46x0h6AYS108YiuK3B9XUhXN9m05Ac6KTEEUdRI3E/dK2dQuRkLjXC8wceQm4A19Gm0uHoMIJYOCbiVoBCH6ayvKbZWZV5lZ4D1JbDNGmKeIj6OX9XWEMKiwTx0Xe89V7BdJzwIGrL0TCLtXuYWZ/R2k+UuBqtgzr44BsBqMpKUA0pcGBoqsEou1M05Ae9fJMF6ADezF5UQZPxT1hrMldiTp3p9iHGfWN2tKHeoW/8CqlIqg9JEkTc+Pl/L9E6ndy5Zjf097PvcmSGhxUQBE7XlrZoIlGhiEU/1HPMen0UUIs0LUu1ywpjCex2yTWnU2YmEwy0MQI1sekSr96QFxDDz9JcynYOYbqR/X9pdxEWyzQ+NJ3n6K97nE1Dj9Sgwu7mFGiUdNkf/SUAF0eZi/eXg71qumpMGBd4eWPtgkeMPLHjvMSYw9vBUfcoKFz6RJ4woG0dw5HOFkPnIjXKWllnl/o01EoBp/o8uswsIS9Nb8i+bp27U6tAHE',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      await expect(decryptConfig(config, 'abc/defg')).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('handles PGP multi-org/repo constraint', async () => {
      GlobalConfig.set({ privateKey: privateKeyPgp });
      config.encrypted = {
        token:
          'wcFMAw+4H7SgaqGOARAAibXL3zr0KZawiND868UGdPpGRo1aVZfn0NUBHpm8mXfgB1rBHaLsP7qa8vxDHpwH9DRD1IyB4vvPUwtu7wmuv1Vtr596tD40CCcCZYB5JjZLWRF0O0xaZFCOi7Z9SqqdaOQoMScyvPO+3/lJkS7zmLllJFH0mQoX5Cr+owUAMSWqbeCQ9r/KAXpnhmpraDjTav48WulcdTMc8iQ/DHimcdzHErLOAjtiQi4OUe1GnDCcN76KQ+c+ZHySnkXrYi/DhOOu9qB4glJ5n68NueFja+8iR39z/wqCI6V6TIUiOyjFN86iVyNPQ4Otem3KuNwrnwSABLDqP491eUNjT8DUDffsyhNC9lnjQLmtViK0EN2yLVpMdHq9cq8lszBChB7gobD9rm8nUHnTuLf6yJvZOj6toD5Yqj8Ibj58wN90Q8CUsBp9/qp0J+hBVUPOx4sT6kM2p6YarlgX3mrIW5c1U+q1eDbCddLjHiU5cW7ja7o+cqlA6mbDRu3HthjBweiXTicXZcRu1o/wy/+laQQ95x5FzAXDnOwQUHBmpTDI3tUJvQ+oy8XyBBbyC0LsBye2c2SLkPJ4Ai3IMR+Mh8puSzVywTbneiAQNBzJHlj5l85nCF2tUjvNo3dWC+9mU5sfXg11iEC6LRbg+icjpqRtTjmQURtciKDUbibWacwU5T/SVAGPXnW7adBOS0PZPIZQcSwjchOdOl0IjzBy6ofu7ODdn2CXZXi8zbevTICXsHvjnW4MAj5oXrStxK3LkWyM3YBOLe7sOfWvWz7n9TM3dHg032navQ',
      };
      let res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      res = await decryptConfig(config, 'def/def');
      expect(res.encrypted).toBeUndefined();
      expect(res.token).toBe('123');
      await expect(decryptConfig(config, 'abc/defg')).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });
  });
});
