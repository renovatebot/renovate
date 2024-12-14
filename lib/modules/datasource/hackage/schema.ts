import { z } from 'zod';

export const HackagePackageMetadata = z.record(z.string());
