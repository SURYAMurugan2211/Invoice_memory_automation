/**
 * Apply Engine for field normalization and correction proposals
 * Applies memory patterns to normalize invoice data and propose corrections
 */

import { MemoryStore } from '../models/MemoryStore';
import { VendorMemory, CorrectionMemory } from '../interfaces/Memory';
import { Invoice, NormalizedInvoice, CorrectedInvoice, ProposedCorrection } from '../interfaces/Invoice';

export class ApplyEngine {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Normalize invoice fields using vendor-specific patterns
   * Requirements: 5.1, 5.2, 5.3
   */
  async normalizeInvoiceFields(invoice: Invoice, vendorMemory: VendorMemory[]): Promise<NormalizedInvoice> {
    try {
      const normalizedFields: Record<string, any> = {};
      const appliedNormalizations: string[] = [];

      // Start with original raw fields
      const fieldsToNormalize = { ...invoice.rawFields };
      
      // Add standard invoice fields to normalization
      fieldsToNormalize['invoiceNumber'] = invoice.invoiceNumber;
      fieldsToNormalize['amount'] = invoice.amount;
      fieldsToNormalize['date'] = invoice.date;
      fieldsToNormalize['vendorName'] = invoice.vendorName;

      // Apply field mappings from vendor memory (confidence-weighted)
      for (const memory of vendorMemory) {
        const weight = this.calculateMemoryWeight(memory);
        
        for (const [originalField, mappedField] of Object.entries(memory.fieldMappings)) {
          if (fieldsToNormalize[originalField] !== undefined) {
            // Apply field mapping with confidence weighting
            if (!normalizedFields[mappedField] || weight > (normalizedFields[mappedField]._weight || 0)) {
              normalizedFields[mappedField] = {
                value: fieldsToNormalize[originalField],
                originalField,
                confidence: memory.confidenceScore,
                _weight: weight
              };
              appliedNormalizations.push(`${originalField} -> ${mappedField} (confidence: ${memory.confidenceScore.toFixed(2)})`);
            }
          }
        }

        // Apply normalization rules
        for (const rule of memory.normalizationRules) {
          const fieldValue = fieldsToNormalize[rule.fieldName];
          if (fieldValue !== undefined && typeof fieldValue === 'string') {
            try {
              const regex = new RegExp(rule.pattern, 'g');
              const normalizedValue = fieldValue.replace(regex, rule.replacement);
              
              if (normalizedValue !== fieldValue) {
                const normalizedFieldName = `${rule.fieldName}_normalized`;
                if (!normalizedFields[normalizedFieldName] || 
                    rule.confidenceScore > (normalizedFields[normalizedFieldName].confidence || 0)) {
                  normalizedFields[normalizedFieldName] = {
                    value: normalizedValue,
                    originalValue: fieldValue,
                    originalField: rule.fieldName,
                    confidence: rule.confidenceScore,
                    rule: rule.pattern
                  };
                  appliedNormalizations.push(
                    `${rule.fieldName}: "${fieldValue}" -> "${normalizedValue}" (confidence: ${rule.confidenceScore.toFixed(2)})`
                  );
                }
              }
            } catch (error) {
              console.warn(`Failed to apply normalization rule for field ${rule.fieldName}: ${error}`);
            }
          }
        }
      }

      // Clean up internal weight properties
      for (const field of Object.keys(normalizedFields)) {
        if (normalizedFields[field]._weight !== undefined) {
          delete normalizedFields[field]._weight;
        }
      }

      return {
        ...invoice,
        normalizedFields,
        appliedNormalizations
      };
    } catch (error) {
      throw new Error(`Failed to normalize invoice fields: ${error}`);
    }
  }

  /**
   * Propose corrections using correction memory
   * Requirements: 5.4, 5.5, 3.3
   */
  async proposeCorrections(invoice: Invoice, correctionMemory: CorrectionMemory[]): Promise<ProposedCorrection[]> {
    try {
      const proposedCorrections: ProposedCorrection[] = [];
      
      // Get all fields that could be corrected
      const fieldsToCheck = {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        date: invoice.date,
        vendorName: invoice.vendorName,
        ...invoice.rawFields
      };

      for (const [fieldName, fieldValue] of Object.entries(fieldsToCheck)) {
        if (fieldValue === undefined || fieldValue === null) continue;

        // Find relevant corrections for this field
        const relevantCorrections = correctionMemory.filter(correction => 
          correction.fieldName === fieldName &&
          this.isValueSimilar(correction.originalValue, String(fieldValue))
        );

        // Sort by confidence and select the best correction
        relevantCorrections.sort((a, b) => b.confidenceScore - a.confidenceScore);

        for (const correction of relevantCorrections) {
          // Only propose corrections above minimum confidence threshold
          if (correction.confidenceScore >= 0.5) {
            const proposedCorrection: ProposedCorrection = {
              field: fieldName,
              originalValue: fieldValue,
              correctedValue: this.parseValue(correction.correctedValue, fieldValue),
              confidence: correction.confidenceScore,
              memorySourceId: correction.id,
              reasoning: this.generateCorrectionReasoning(correction, fieldValue)
            };

            // Avoid duplicate corrections for the same field
            const existingCorrection = proposedCorrections.find(pc => pc.field === fieldName);
            if (!existingCorrection || proposedCorrection.confidence > existingCorrection.confidence) {
              if (existingCorrection) {
                const index = proposedCorrections.indexOf(existingCorrection);
                proposedCorrections.splice(index, 1);
              }
              proposedCorrections.push(proposedCorrection);
            }
          }
        }
      }

      return proposedCorrections;
    } catch (error) {
      throw new Error(`Failed to propose corrections: ${error}`);
    }
  }

  /**
   * Apply high-confidence corrections to create corrected invoice
   * Requirements: 5.4, 6.4
   */
  async applyHighConfidenceCorrections(
    invoice: Invoice, 
    corrections: ProposedCorrection[]
  ): Promise<CorrectedInvoice> {
    try {
      // First normalize the invoice
      const vendorMemory = await this.memoryStore.getVendorMemory(invoice.vendorName);
      const normalizedInvoice = await this.normalizeInvoiceFields(invoice, vendorMemory);

      // Filter corrections by confidence threshold (only auto-apply high confidence)
      const highConfidenceCorrections = corrections.filter(correction => 
        correction.confidence >= 0.85 // Auto-apply threshold
      );

      const appliedCorrections: ProposedCorrection[] = [];
      const correctedInvoice: CorrectedInvoice = {
        ...normalizedInvoice,
        appliedCorrections: []
      };

      // Apply corrections to appropriate fields
      for (const correction of highConfidenceCorrections) {
        try {
          switch (correction.field) {
            case 'invoiceNumber':
              correctedInvoice.invoiceNumber = String(correction.correctedValue);
              break;
            case 'amount':
              correctedInvoice.amount = Number(correction.correctedValue);
              break;
            case 'date':
              correctedInvoice.date = new Date(correction.correctedValue);
              break;
            case 'vendorName':
              correctedInvoice.vendorName = String(correction.correctedValue);
              break;
            default:
              // Apply to raw fields
              correctedInvoice.rawFields = {
                ...correctedInvoice.rawFields,
                [correction.field]: correction.correctedValue
              };
              break;
          }

          appliedCorrections.push(correction);

          // Log the correction application for audit trail
          await this.logCorrectionApplication(correction, invoice.id);

        } catch (error) {
          console.warn(`Failed to apply correction for field ${correction.field}: ${error}`);
        }
      }

      correctedInvoice.appliedCorrections = appliedCorrections;
      return correctedInvoice;

    } catch (error) {
      throw new Error(`Failed to apply corrections: ${error}`);
    }
  }

  /**
   * Calculate memory weight based on confidence and usage
   */
  private calculateMemoryWeight(memory: VendorMemory): number {
    // Weight combines confidence score and usage count
    const confidenceWeight = memory.confidenceScore * 0.7;
    const usageWeight = Math.min(memory.usageCount / 100, 0.3); // Cap usage weight at 0.3
    return confidenceWeight + usageWeight;
  }

  /**
   * Check if two values are similar enough for correction matching
   */
  private isValueSimilar(originalValue: string, currentValue: string): boolean {
    // Exact match
    if (originalValue === currentValue) return true;

    // Case-insensitive match
    if (originalValue.toLowerCase() === currentValue.toLowerCase()) return true;

    // Fuzzy matching for strings (simple Levenshtein-like approach)
    if (typeof originalValue === 'string' && typeof currentValue === 'string') {
      const similarity = this.calculateStringSimilarity(originalValue, currentValue);
      return similarity >= 0.8; // 80% similarity threshold
    }

    return false;
  }

  /**
   * Calculate string similarity (simple approach)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Parse corrected value to appropriate type based on original value
   */
  private parseValue(correctedValue: string, originalValue: any): any {
    if (typeof originalValue === 'number') {
      const parsed = Number(correctedValue);
      return isNaN(parsed) ? originalValue : parsed;
    }
    
    if (originalValue instanceof Date) {
      const parsed = new Date(correctedValue);
      return isNaN(parsed.getTime()) ? originalValue : parsed;
    }
    
    return correctedValue;
  }

  /**
   * Generate reasoning for correction proposal
   */
  private generateCorrectionReasoning(correction: CorrectionMemory, currentValue: any): string {
    const approvalRate = correction.approvalCount / (correction.approvalCount + correction.rejectionCount + 1);
    
    return `Based on ${correction.approvalCount} previous approvals ` +
           `(${(approvalRate * 100).toFixed(1)}% success rate), ` +
           `suggesting "${correction.correctedValue}" for "${currentValue}" ` +
           `in field "${correction.fieldName}" with ${(correction.confidenceScore * 100).toFixed(1)}% confidence`;
  }

  /**
   * Log correction application for audit trail
   */
  private async logCorrectionApplication(correction: ProposedCorrection, invoiceId: string): Promise<void> {
    try {
      // This would typically log to the audit system
      // For now, we'll just log to console
      console.log(`Applied correction: ${correction.field} changed from "${correction.originalValue}" to "${correction.correctedValue}" for invoice ${invoiceId}`);
    } catch (error) {
      console.warn(`Failed to log correction application: ${error}`);
    }
  }
}