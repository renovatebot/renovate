import {z} from 'zod';


export const BitriseStep = z.record(z.string(), z.unknown())

export const BitriseWorkflow = z.object({
  steps: z.array(BitriseStep)
})

export const BitriseFile = z.object({
  workflows: z.record(z.string(), BitriseWorkflow)
})
