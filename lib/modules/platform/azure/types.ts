import type { Pr } from '../types';

export interface AzurePr extends Pr {
  sourceRefName?: string;
}

export const AzurePrVote = {
  NoVote: 0,
  Reject: -10,
  WaitingForAuthor: -5,
  ApprovedWithSuggestions: 5,
  Approved: 10,
} as const;

export const AzurePolicyTypes = {
  RequiredReviewers: 'fd2167ab-b0be-447a-8ec8-39368250530e',
  RequireAMergeStrategy: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
  MinimumNumberOfReviewers: 'fa4e907d-c16b-4a4c-9dfa-4906e5d171dd',
  Build: '0609b952-1397-4640-95ec-e00a01b2c241',
  WorkItemLinking: '40e92b44-2fe1-4dd6-b3d8-74a9c21d0c6e',
} as const;

export type AzurePolicyTypeUuid =
  (typeof AzurePolicyTypes)[keyof typeof AzurePolicyTypes];

export type AzurePolicyType =
  | keyof typeof AzurePolicyTypes
  | AzurePolicyTypeUuid;

export const getAzurePolicyTypes = (): string[] => [
  ...Object.values(AzurePolicyTypes),
  ...Object.keys(AzurePolicyTypes),
];
