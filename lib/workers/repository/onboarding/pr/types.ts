/** Container type for the rendered strings for the Onboarding PR. */
export interface OnboardingPrSections {
  packageFiles: string;
  config: string;
  baseBranch: string;
  prList: string;
  warnings: string;
  errors: string;
}

/** Container type for the rendered strings for the Reconfigure PR's comment. */
export interface ReconfigurePrCommentSections {
  packageFiles: string;
  config: string;
  baseBranch: string;
  prList: string;
  warnings: string;
  errors: string;
}
