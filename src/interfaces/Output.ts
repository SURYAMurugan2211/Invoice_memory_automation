/**
 * Output contract interfaces for system results
 */

export interface InvoiceProcessingResult {
  invoiceId: string;
  decision: 'auto-accept' | 'auto-correct' | 'human-review';
  confidenceScore: number;
  reasoning: string;
  appliedCorrections: {
    field: string;
    originalValue: any;
    correctedValue: any;
    confidence: number;
  }[];
  memoryInsights: {
    vendorPatternsUsed: number;
    correctionsApplied: number;
    historicalAccuracy: number;
  };
  auditTrail: {
    operationId: string;
    timestamp: string;
    reasoning: string;
  }[];
}