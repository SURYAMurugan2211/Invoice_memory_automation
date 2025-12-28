/**
 * Processing decision and workflow interfaces
 */

import { ProposedCorrection } from './Invoice';

export type DecisionType = 'auto-accept' | 'auto-correct' | 'human-review';

export interface ProcessingDecision {
  action: DecisionType;
  confidenceScore: number;
  reasoning: string;
  appliedCorrections: ProposedCorrection[];
  memorySourceIds: string[];
}

export interface Feedback {
  correctionId: string;
  approved: boolean;
  reasoning?: string;
  timestamp: Date;
}