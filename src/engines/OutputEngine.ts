/**
 * Output Engine for JSON contract formatting and validation
 * Ensures all output conforms to the exact JSON structure specification
 */

import { InvoiceProcessingResult } from '../interfaces/Output';
import { Invoice, ProposedCorrection } from '../interfaces/Invoice';
import { ProcessingDecision } from './DecisionEngine';
import { MemoryInsights } from '../interfaces/Memory';
import { AuditLog } from '../interfaces/Audit';

export interface OutputValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class OutputEngine {
  /**
   * Create InvoiceProcessingResult output structure
   * Requirements: 8.1, 8.2, 8.3
   */
  createInvoiceProcessingResult(
    invoice: Invoice,
    decision: ProcessingDecision,
    insights: MemoryInsights,
    auditLogs: AuditLog[] = []
  ): InvoiceProcessingResult {
    try {
      // Validate confidence score range
      const validatedConfidenceScore = this.validateConfidenceScore(decision.confidenceScore);

      // Format applied corrections
      const appliedCorrections = decision.appliedCorrections.map(correction => ({
        field: correction.field,
        originalValue: this.sanitizeValue(correction.originalValue),
        correctedValue: this.sanitizeValue(correction.correctedValue),
        confidence: this.validateConfidenceScore(correction.confidence)
      }));

      // Calculate memory insights
      const memoryInsights = this.calculateMemoryInsights(insights, decision.appliedCorrections);

      // Format audit trail
      const auditTrail = this.formatAuditTrail(auditLogs, decision);

      // Create structured reasoning
      const structuredReasoning = this.createStructuredReasoning(decision, insights);

      const result: InvoiceProcessingResult = {
        invoiceId: invoice.id,
        decision: decision.action,
        confidenceScore: validatedConfidenceScore,
        reasoning: structuredReasoning,
        appliedCorrections,
        memoryInsights,
        auditTrail
      };

      // Validate the complete result
      const validation = this.validateOutput(result);
      if (!validation.isValid) {
        throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
      }

      return result;
    } catch (error) {
      // Return error-safe output that maintains contract format
      return this.createErrorOutput(invoice.id, error);
    }
  }

  /**
   * Implement error handling in output formatting
   * Requirements: 8.4, 8.5
   */
  createErrorOutput(invoiceId: string, error: any): InvoiceProcessingResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      invoiceId: invoiceId || 'unknown',
      decision: 'human-review',
      confidenceScore: 0.0,
      reasoning: `Error occurred during processing: ${this.sanitizeErrorMessage(errorMessage)}. Defaulting to human review for safety.`,
      appliedCorrections: [],
      memoryInsights: {
        vendorPatternsUsed: 0,
        correctionsApplied: 0,
        historicalAccuracy: 0.0
      },
      auditTrail: [{
        operationId: `error_${Date.now()}`,
        timestamp: new Date().toISOString(),
        reasoning: `Processing error: ${this.sanitizeErrorMessage(errorMessage)}`
      }]
    };
  }

  /**
   * Validate output for JSON structure compliance
   * Requirements: 8.1, 8.2
   */
  validateOutput(result: InvoiceProcessingResult): OutputValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!result.invoiceId || typeof result.invoiceId !== 'string') {
      errors.push('invoiceId must be a non-empty string');
    }

    if (!['auto-accept', 'auto-correct', 'human-review'].includes(result.decision)) {
      errors.push('decision must be one of: auto-accept, auto-correct, human-review');
    }

    if (typeof result.confidenceScore !== 'number' || 
        result.confidenceScore < 0 || 
        result.confidenceScore > 1) {
      errors.push('confidenceScore must be a number between 0 and 1');
    }

    if (!result.reasoning || typeof result.reasoning !== 'string') {
      errors.push('reasoning must be a non-empty string');
    }

    // Validate appliedCorrections array
    if (!Array.isArray(result.appliedCorrections)) {
      errors.push('appliedCorrections must be an array');
    } else {
      result.appliedCorrections.forEach((correction, index) => {
        if (!correction.field || typeof correction.field !== 'string') {
          errors.push(`appliedCorrections[${index}].field must be a non-empty string`);
        }
        if (typeof correction.confidence !== 'number' || 
            correction.confidence < 0 || 
            correction.confidence > 1) {
          errors.push(`appliedCorrections[${index}].confidence must be a number between 0 and 1`);
        }
      });
    }

    // Validate memoryInsights
    if (!result.memoryInsights) {
      errors.push('memoryInsights is required');
    } else {
      const insights = result.memoryInsights;
      if (typeof insights.vendorPatternsUsed !== 'number' || insights.vendorPatternsUsed < 0) {
        errors.push('memoryInsights.vendorPatternsUsed must be a non-negative number');
      }
      if (typeof insights.correctionsApplied !== 'number' || insights.correctionsApplied < 0) {
        errors.push('memoryInsights.correctionsApplied must be a non-negative number');
      }
      if (typeof insights.historicalAccuracy !== 'number' || 
          insights.historicalAccuracy < 0 || 
          insights.historicalAccuracy > 1) {
        errors.push('memoryInsights.historicalAccuracy must be a number between 0 and 1');
      }
    }

    // Validate auditTrail
    if (!Array.isArray(result.auditTrail)) {
      errors.push('auditTrail must be an array');
    } else {
      result.auditTrail.forEach((entry, index) => {
        if (!entry.operationId || typeof entry.operationId !== 'string') {
          errors.push(`auditTrail[${index}].operationId must be a non-empty string`);
        }
        if (!entry.timestamp || typeof entry.timestamp !== 'string') {
          errors.push(`auditTrail[${index}].timestamp must be a non-empty string`);
        } else {
          // Validate ISO timestamp format
          const date = new Date(entry.timestamp);
          if (isNaN(date.getTime())) {
            errors.push(`auditTrail[${index}].timestamp must be a valid ISO timestamp`);
          }
        }
        if (!entry.reasoning || typeof entry.reasoning !== 'string') {
          errors.push(`auditTrail[${index}].reasoning must be a non-empty string`);
        }
      });
    }

    // Warnings for best practices
    if (result.appliedCorrections.length > 0 && result.decision === 'human-review') {
      warnings.push('Applied corrections present but decision is human-review');
    }

    if (result.confidenceScore > 0.8 && result.decision === 'human-review') {
      warnings.push('High confidence score but decision is human-review');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Serialize to JSON with proper escaping
   * Requirements: 8.5
   */
  toJSON(result: InvoiceProcessingResult): string {
    try {
      return JSON.stringify(result, this.jsonReplacer, 2);
    } catch (error) {
      // Fallback to error output if serialization fails
      const errorOutput = this.createErrorOutput(
        result.invoiceId, 
        `JSON serialization failed: ${error}`
      );
      return JSON.stringify(errorOutput, null, 2);
    }
  }

  /**
   * Parse JSON with validation
   * Requirements: 8.5
   */
  fromJSON(jsonString: string): InvoiceProcessingResult {
    try {
      const parsed = JSON.parse(jsonString);
      const validation = this.validateOutput(parsed);
      
      if (!validation.isValid) {
        throw new Error(`Invalid JSON structure: ${validation.errors.join(', ')}`);
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Validate confidence score range
   */
  private validateConfidenceScore(score: number): number {
    if (typeof score !== 'number' || isNaN(score)) {
      return 0.0;
    }
    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Sanitize values for JSON output
   */
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'string') {
      // Escape special characters and limit length
      return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').substring(0, 1000);
    }
    
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value).substring(0, 100);
      }
    }
    
    return value;
  }

  /**
   * Calculate memory insights from available data
   */
  private calculateMemoryInsights(
    insights: MemoryInsights, 
    appliedCorrections: ProposedCorrection[]
  ): InvoiceProcessingResult['memoryInsights'] {
    // Calculate historical accuracy based on vendor patterns
    const totalPatterns = insights.vendorPatterns.length + 
                         insights.suggestedCorrections.length + 
                         insights.historicalResolutions.length;
    
    const successfulResolutions = insights.historicalResolutions.filter(r => r.outcomeSuccess).length;
    const historicalAccuracy = totalPatterns > 0 ? 
      (successfulResolutions / insights.historicalResolutions.length) || 0 : 0;

    return {
      vendorPatternsUsed: insights.vendorPatterns.length,
      correctionsApplied: appliedCorrections.length,
      historicalAccuracy: this.validateConfidenceScore(historicalAccuracy)
    };
  }

  /**
   * Format audit trail from audit logs
   */
  private formatAuditTrail(auditLogs: AuditLog[], decision: ProcessingDecision): InvoiceProcessingResult['auditTrail'] {
    const auditTrail = auditLogs.map(log => ({
      operationId: log.id,
      timestamp: log.timestamp.toISOString(),
      reasoning: log.reasoning
    }));

    // Add decision audit entry
    auditTrail.push({
      operationId: `decision_${Date.now()}`,
      timestamp: new Date().toISOString(),
      reasoning: `Decision made: ${decision.action} with confidence ${(decision.confidenceScore * 100).toFixed(1)}%`
    });

    return auditTrail;
  }

  /**
   * Create structured reasoning fields
   * Requirements: 8.3
   */
  private createStructuredReasoning(decision: ProcessingDecision, insights: MemoryInsights): string {
    const reasoningParts = [
      `Decision: ${decision.action.toUpperCase()}`,
      `Confidence: ${(decision.confidenceScore * 100).toFixed(1)}%`,
      `Memory Sources: ${decision.memorySourceIds.length} pattern(s)`,
      `Applied Corrections: ${decision.appliedCorrections.length}`,
      decision.reasoning
    ];

    if (decision.safetyConstraints.length > 0) {
      reasoningParts.push(`Safety Constraints: ${decision.safetyConstraints.join(', ')}`);
    }

    if (insights.reasoning.length > 0) {
      reasoningParts.push(`Memory Analysis: ${insights.reasoning.join('; ')}`);
    }

    return reasoningParts.join(' | ');
  }

  /**
   * Sanitize error messages for output
   */
  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .substring(0, 200) // Limit length
      .replace(/"/g, "'"); // Replace quotes to prevent JSON issues
  }

  /**
   * JSON replacer function for safe serialization
   */
  private jsonReplacer(_key: string, value: any): any {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value instanceof Error) {
        return value.message;
      }
    }
    
    // Handle special number values
    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        return null;
      }
    }
    
    return value;
  }
}