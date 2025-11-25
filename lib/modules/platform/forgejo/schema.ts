import { z } from 'zod';

export const ContentsResponse = z.object({
  name: z.string(),
  path: z.string(),
  type: z.union([z.literal('file'), z.literal('dir')]),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponse>;

export const ContentsListResponse = z.array(ContentsResponse);

export const OrgTeam = z.object({
  id: z.number(),
  name: z.string(),
});
export type OrgTeam = z.infer<typeof OrgTeam>;
export const OrgTeamList = z.array(OrgTeam);
export type OrgTeamList = z.infer<typeof OrgTeamList>;
