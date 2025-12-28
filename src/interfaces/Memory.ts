/**
 * Memory-related data structures for storing and retrieving patterns
 */

export interface NormalizationRule {
  fieldName: string;
  pattern: string;
  replacement: string;
  confidenceScore: number;
}

export interface VendorMemory {
  id: string;
  vendorName: string;
  fieldMappings: Record<string, string>;
  normalizationRules: NormalizationRule[];
  confidenceScore: number;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

export interface CorrectionMemory {
  id: string;
  originalValue: string;
  correctedValue: string;
  fieldName: string;
  vendorName?: string;
  confidenceScore: number;
  approvalCount: number;
  rejectionCount: number;
  createdAt: Date;
}

export interface ResolutionMemory {
  id: string;
  invoicePattern: string;
  decision: 'auto-accept' | 'auto-correct' | 'human-review';
  confidenceScore: number;
  outcomeSuccess: boolean;
  reasoning: string;
  createdAt: Date;
}

export interface MemoryInsights {
  vendorPatterns: VendorMemory[];
  suggestedCorrections: CorrectionMemory[];
  historicalResolutions: ResolutionMemory[];
  overallConfidence: number;
  reasoning: string[];
}