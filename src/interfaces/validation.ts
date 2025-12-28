/**
 * Validation functions for data integrity
 */

import { 
  Invoice, 
  VendorMemory, 
  CorrectionMemory, 
  ResolutionMemory, 
  AuditLog,
  ProcessingDecision,
  InvoiceProcessingResult,
  LineItem,
  ProcessingMetadata
} from './index';

/**
 * Validates that a confidence score is within the valid range [0, 1]
 */
export function isValidConfidenceScore(score: number): boolean {
  return typeof score === 'number' && 
         !isNaN(score) && 
         score >= 0 && 
         score <= 1;
}

/**
 * Validates a line item structure
 */
export function isValidLineItem(item: any): item is LineItem {
  return typeof item === 'object' &&
         typeof item.description === 'string' &&
         typeof item.quantity === 'number' &&
         typeof item.unitPrice === 'number' &&
         typeof item.totalPrice === 'number' &&
         item.quantity >= 0 &&
         item.unitPrice >= 0 &&
         item.totalPrice >= 0;
}

/**
 * Validates processing metadata structure
 */
export function isValidProcessingMetadata(metadata: any): metadata is ProcessingMetadata {
  return typeof metadata === 'object' &&
         metadata.receivedAt instanceof Date &&
         metadata.processingStarted instanceof Date &&
         Array.isArray(metadata.memorySourceIds) &&
         typeof metadata.humanReviewRequired === 'boolean' &&
         (metadata.confidenceScore === undefined || isValidConfidenceScore(metadata.confidenceScore));
}

/**
 * Validates an invoice structure
 */
export function isValidInvoice(invoice: any): invoice is Invoice {
  return typeof invoice === 'object' &&
         typeof invoice.id === 'string' &&
         invoice.id.length > 0 &&
         typeof invoice.vendorName === 'string' &&
         invoice.vendorName.length > 0 &&
         typeof invoice.invoiceNumber === 'string' &&
         invoice.invoiceNumber.length > 0 &&
         typeof invoice.amount === 'number' &&
         invoice.amount >= 0 &&
         invoice.date instanceof Date &&
         Array.isArray(invoice.lineItems) &&
         invoice.lineItems.every(isValidLineItem) &&
         typeof invoice.rawFields === 'object' &&
         isValidProcessingMetadata(invoice.processingMetadata);
}

/**
 * Validates vendor memory structure
 */
export function isValidVendorMemory(memory: any): memory is VendorMemory {
  return typeof memory === 'object' &&
         typeof memory.id === 'string' &&
         memory.id.length > 0 &&
         typeof memory.vendorName === 'string' &&
         memory.vendorName.length > 0 &&
         typeof memory.fieldMappings === 'object' &&
         Array.isArray(memory.normalizationRules) &&
         isValidConfidenceScore(memory.confidenceScore) &&
         typeof memory.usageCount === 'number' &&
         memory.usageCount >= 0 &&
         memory.lastUsed instanceof Date &&
         memory.createdAt instanceof Date;
}

/**
 * Validates correction memory structure
 */
export function isValidCorrectionMemory(memory: any): memory is CorrectionMemory {
  return typeof memory === 'object' &&
         typeof memory.id === 'string' &&
         memory.id.length > 0 &&
         typeof memory.originalValue === 'string' &&
         typeof memory.correctedValue === 'string' &&
         typeof memory.fieldName === 'string' &&
         memory.fieldName.length > 0 &&
         (memory.vendorName === undefined || typeof memory.vendorName === 'string') &&
         isValidConfidenceScore(memory.confidenceScore) &&
         typeof memory.approvalCount === 'number' &&
         memory.approvalCount >= 0 &&
         typeof memory.rejectionCount === 'number' &&
         memory.rejectionCount >= 0 &&
         memory.createdAt instanceof Date;
}

/**
 * Validates resolution memory structure
 */
export function isValidResolutionMemory(memory: any): memory is ResolutionMemory {
  const validDecisions = ['auto-accept', 'auto-correct', 'human-review'];
  
  return typeof memory === 'object' &&
         typeof memory.id === 'string' &&
         memory.id.length > 0 &&
         typeof memory.invoicePattern === 'string' &&
         memory.invoicePattern.length > 0 &&
         validDecisions.includes(memory.decision) &&
         isValidConfidenceScore(memory.confidenceScore) &&
         typeof memory.outcomeSuccess === 'boolean' &&
         typeof memory.reasoning === 'string' &&
         memory.reasoning.length > 0 &&
         memory.createdAt instanceof Date;
}

/**
 * Validates audit log structure
 */
export function isValidAuditLog(log: any): log is AuditLog {
  return typeof log === 'object' &&
         typeof log.id === 'string' &&
         log.id.length > 0 &&
         typeof log.operation === 'string' &&
         log.operation.length > 0 &&
         typeof log.entityType === 'string' &&
         log.entityType.length > 0 &&
         typeof log.entityId === 'string' &&
         log.entityId.length > 0 &&
         typeof log.reasoning === 'string' &&
         log.reasoning.length > 0 &&
         (log.confidenceScore === undefined || isValidConfidenceScore(log.confidenceScore)) &&
         log.timestamp instanceof Date;
}

/**
 * Validates processing decision structure
 */
export function isValidProcessingDecision(decision: any): decision is ProcessingDecision {
  const validActions = ['auto-accept', 'auto-correct', 'human-review'];
  
  return typeof decision === 'object' &&
         validActions.includes(decision.action) &&
         isValidConfidenceScore(decision.confidenceScore) &&
         typeof decision.reasoning === 'string' &&
         decision.reasoning.length > 0 &&
         Array.isArray(decision.appliedCorrections) &&
         Array.isArray(decision.memorySourceIds);
}

/**
 * Validates invoice processing result structure
 */
export function isValidInvoiceProcessingResult(result: any): result is InvoiceProcessingResult {
  const validDecisions = ['auto-accept', 'auto-correct', 'human-review'];
  
  return typeof result === 'object' &&
         typeof result.invoiceId === 'string' &&
         result.invoiceId.length > 0 &&
         validDecisions.includes(result.decision) &&
         isValidConfidenceScore(result.confidenceScore) &&
         typeof result.reasoning === 'string' &&
         result.reasoning.length > 0 &&
         Array.isArray(result.appliedCorrections) &&
         typeof result.memoryInsights === 'object' &&
         typeof result.memoryInsights.vendorPatternsUsed === 'number' &&
         typeof result.memoryInsights.correctionsApplied === 'number' &&
         typeof result.memoryInsights.historicalAccuracy === 'number' &&
         result.memoryInsights.vendorPatternsUsed >= 0 &&
         result.memoryInsights.correctionsApplied >= 0 &&
         isValidConfidenceScore(result.memoryInsights.historicalAccuracy) &&
         Array.isArray(result.auditTrail);
}