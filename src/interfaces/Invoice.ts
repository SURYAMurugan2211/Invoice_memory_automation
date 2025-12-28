/**
 * Core invoice data structures and related interfaces
 */

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface ProcessingMetadata {
  receivedAt: Date;
  processingStarted: Date;
  confidenceScore?: number;
  memorySourceIds: string[];
  humanReviewRequired: boolean;
}

export interface Invoice {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  date: Date;
  lineItems: LineItem[];
  rawFields: Record<string, any>;
  processingMetadata: ProcessingMetadata;
}

export interface NormalizedInvoice extends Invoice {
  normalizedFields: Record<string, any>;
  appliedNormalizations: string[];
}

export interface CorrectedInvoice extends NormalizedInvoice {
  appliedCorrections: ProposedCorrection[];
}

export interface ProposedCorrection {
  field: string;
  originalValue: any;
  correctedValue: any;
  confidence: number;
  memorySourceId: string;
  reasoning: string;
}