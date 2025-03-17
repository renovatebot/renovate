import { z } from 'zod';

// See https://github.com/haskell/hackage-server
// revision e885d36c
// src/Distribution/Server/Features/PackageInfoJSON/State.hs line 160
const VersionStatus = z.enum(['normal', 'deprecated', 'unpreferred']);

export const HackagePackageMetadata = z.record(VersionStatus);
