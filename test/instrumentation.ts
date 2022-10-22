import { afterAll } from '@jest/globals';
import { disableInstrumentations } from '../lib/instrumentation';

afterAll(disableInstrumentations);
