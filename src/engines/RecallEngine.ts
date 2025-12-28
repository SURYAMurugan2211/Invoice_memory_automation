/**
 * Recall Engine for confidence-weighted memory retrieval
 * Retrieves relevant memory patterns with confidence weighting and deduplication
 */

import { MemoryStore } from '../models/MemoryStore';
import { VendorMemory, CorrectionMemory, ResolutionMemory, MemoryInsights } from '../interfaces/Memory';
import { Invoice } from '../interfaces/Invoice';

export class RecallEngine {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Get vendor memory with confidence-based ordering
   * Requirements: 1.3, 3.2, 7.4
   */
  async getVendorMemory(vendorName: string): Promise<VendorMemory[]> {
    try {
      const vendorMemories = await this.memoryStore.getVendorMemory(vendorName);
      
      // Update usage count for accessed memories
      for (const memory of vendorMemories) {
        await this.memoryStore.updateVendorMemoryUsage(memory.id);
      }

      // Return memories already sorted by confidence score (done in MemoryStore)
      return vendorMemories;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve vendor memory for ${vendorName}: ${errorMessage}`);
    }
  }

  /**
   * Get correction memory with confidence-based ordering
   * Requirements: 1.3, 3.2
   */
  async getCorrectionMemory(fieldName: string, vendorName?: string): Promise<CorrectionMemory[]> {
    try {
      const correctionMemories = await this.memoryStore.getCorrectionMemory(fieldName, vendorName);
      
      // Filter out low-confidence corrections (below 0.3)
      const filteredMemories = correctionMemories.filter(memory => memory.confidenceScore >= 0.3);
      
      return filteredMemories;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve correction memory for field ${fieldName}: ${errorMessage}`);
    }
  }

  /**
   * Get resolution memory with pattern matching
   * Requirements: 1.3, 3.2
   */
  async getResolutionMemory(invoicePattern: string): Promise<ResolutionMemory[]> {
    try {
      const resolutionMemories = await this.memoryStore.getResolutionMemory(invoicePattern);
      
      // Filter out unsuccessful outcomes with low confidence
      const filteredMemories = resolutionMemories.filter(memory => 
        memory.outcomeSuccess || memory.confidenceScore >= 0.5
      );
      
      return filteredMemories;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve resolution memory for pattern ${invoicePattern}: ${errorMessage}`);
    }
  }

  /**
   * Get comprehensive confidence-weighted insights for an invoice
   * Requirements: 1.3, 3.2, 7.4
   */
  async getConfidenceWeightedInsights(invoice: Invoice): Promise<MemoryInsights> {
    try {
      // Generate invoice pattern for resolution memory lookup
      const invoicePattern = this.generateInvoicePattern(invoice);
      
      // Retrieve all relevant memory types
      const [vendorPatterns, suggestedCorrections, historicalResolutions] = await Promise.all([
        this.getVendorMemory(invoice.vendorName),
        this.getCorrectionMemoryForInvoice(invoice),
        this.getResolutionMemory(invoicePattern)
      ]);

      // Calculate overall confidence based on available memory
      const overallConfidence = this.calculateOverallConfidence(
        vendorPatterns,
        suggestedCorrections,
        historicalResolutions
      );

      // Generate reasoning for the insights
      const reasoning = this.generateInsightReasoning(
        vendorPatterns,
        suggestedCorrections,
        historicalResolutions,
        overallConfidence
      );

      return {
        vendorPatterns,
        suggestedCorrections,
        historicalResolutions,
        overallConfidence,
        reasoning
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate confidence-weighted insights: ${errorMessage}`);
    }
  }

  /**
   * Get correction memory relevant to a specific invoice
   */
  private async getCorrectionMemoryForInvoice(invoice: Invoice): Promise<CorrectionMemory[]> {
    const allCorrections: CorrectionMemory[] = [];
    
    // Get corrections for each field in the invoice
    const fieldNames = [
      'invoiceNumber',
      'amount',
      'date',
      'vendorName',
      ...Object.keys(invoice.rawFields)
    ];

    for (const fieldName of fieldNames) {
      const corrections = await this.getCorrectionMemory(fieldName, invoice.vendorName);
      allCorrections.push(...corrections);
    }

    // Remove duplicates and sort by confidence
    const uniqueCorrections = this.deduplicateCorrections(allCorrections);
    return uniqueCorrections.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Generate a pattern string for invoice resolution memory lookup
   */
  private generateInvoicePattern(invoice: Invoice): string {
    const pattern = {
      vendor: invoice.vendorName,
      amountRange: this.getAmountRange(invoice.amount),
      fieldCount: Object.keys(invoice.rawFields).length,
      hasLineItems: invoice.lineItems.length > 0
    };

    return JSON.stringify(pattern);
  }

  /**
   * Get amount range category for pattern matching
   */
  private getAmountRange(amount: number): string {
    if (amount < 100) return 'small';
    if (amount < 1000) return 'medium';
    if (amount < 10000) return 'large';
    return 'very-large';
  }

  /**
   * Calculate overall confidence based on available memory patterns
   */
  private calculateOverallConfidence(
    vendorPatterns: VendorMemory[],
    corrections: CorrectionMemory[],
    resolutions: ResolutionMemory[]
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    // Vendor patterns contribute 50% of confidence
    if (vendorPatterns.length > 0) {
      const vendorConfidence = vendorPatterns.reduce((sum, pattern) => 
        sum + pattern.confidenceScore * pattern.usageCount, 0
      ) / vendorPatterns.reduce((sum, pattern) => sum + pattern.usageCount, 1);
      
      weightedSum += vendorConfidence * 0.5;
      totalWeight += 0.5;
    }

    // Correction patterns contribute 30% of confidence
    if (corrections.length > 0) {
      const correctionConfidence = corrections.reduce((sum, correction) => 
        sum + correction.confidenceScore, 0
      ) / corrections.length;
      
      weightedSum += correctionConfidence * 0.3;
      totalWeight += 0.3;
    }

    // Resolution patterns contribute 20% of confidence
    if (resolutions.length > 0) {
      const resolutionConfidence = resolutions.reduce((sum, resolution) => 
        sum + resolution.confidenceScore, 0
      ) / resolutions.length;
      
      weightedSum += resolutionConfidence * 0.2;
      totalWeight += 0.2;
    }

    // Return weighted average, or 0.1 if no memory available
    return totalWeight > 0 ? Math.min(1.0, weightedSum / totalWeight) : 0.1;
  }

  /**
   * Generate reasoning explanation for the insights
   */
  private generateInsightReasoning(
    vendorPatterns: VendorMemory[],
    corrections: CorrectionMemory[],
    resolutions: ResolutionMemory[],
    overallConfidence: number
  ): string[] {
    const reasoning: string[] = [];

    // Vendor pattern reasoning
    if (vendorPatterns.length > 0) {
      const avgConfidence = vendorPatterns.reduce((sum, p) => sum + p.confidenceScore, 0) / vendorPatterns.length;
      const totalUsage = vendorPatterns.reduce((sum, p) => sum + p.usageCount, 0);
      
      reasoning.push(
        `Found ${vendorPatterns.length} vendor pattern(s) with average confidence ${avgConfidence.toFixed(2)} ` +
        `and total usage count ${totalUsage}`
      );
    } else {
      reasoning.push('No vendor-specific patterns found - using default processing');
    }

    // Correction pattern reasoning
    if (corrections.length > 0) {
      const highConfidenceCorrections = corrections.filter(c => c.confidenceScore >= 0.7).length;
      reasoning.push(
        `Found ${corrections.length} relevant correction(s), ${highConfidenceCorrections} with high confidence (≥0.7)`
      );
    } else {
      reasoning.push('No relevant correction patterns found');
    }

    // Resolution pattern reasoning
    if (resolutions.length > 0) {
      const successfulResolutions = resolutions.filter(r => r.outcomeSuccess).length;
      reasoning.push(
        `Found ${resolutions.length} similar resolution(s), ${successfulResolutions} were successful`
      );
    } else {
      reasoning.push('No similar resolution patterns found');
    }

    // Overall confidence reasoning
    if (overallConfidence >= 0.85) {
      reasoning.push('High confidence - suitable for auto-processing');
    } else if (overallConfidence >= 0.65) {
      reasoning.push('Medium confidence - corrections may be proposed');
    } else {
      reasoning.push('Low confidence - human review recommended');
    }

    return reasoning;
  }

  /**
   * Remove duplicate corrections based on field name and values
   */
  private deduplicateCorrections(corrections: CorrectionMemory[]): CorrectionMemory[] {
    const seen = new Set<string>();
    const unique: CorrectionMemory[] = [];

    for (const correction of corrections) {
      const key = `${correction.fieldName}:${correction.originalValue}:${correction.correctedValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(correction);
      }
    }

    return unique;
  }
}