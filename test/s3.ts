import { jest } from '@jest/globals';
import * as _s3 from '../lib/util/s3';

export const s3 = jest.mocked(_s3);
