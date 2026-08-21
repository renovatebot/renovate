import type { ManagerApi } from '../types.ts';
import * as jsonata from './jsonata/index.ts';
import * as regex from './regex/index.ts';

const api = new Map<string, ManagerApi>();
export default api;

api.set('regex', regex);
api.set('jsonata', jsonata);
