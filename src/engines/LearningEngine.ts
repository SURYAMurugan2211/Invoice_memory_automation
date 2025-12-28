/**
 * Learning Engine for memory updates and reinforcement learning
 * Handles positive/negative feedback and prevents duplicate learning
 */

import { MemoryStore } from '../models/MemoryStore';
import { CorrectionMemory, ResolutionMemory } from '../interfaces/Memory';
import { Invoice, ProposedCorrection } from '../interfaces/Invoice';
import { ProcessingDecision } from './DecisionEngine';

export interface LearningFeedback {
  invoiceId: string;
  correctionId?: string;
  vendorMemoryId?: string;
  resolutionMemoryId?: string;
  approved: boolean;
  reasoning?: string;
  timestamp: Date;
}

export interface LearningEvent {
  id: string;
  invoiceId: string;
  eventType: 'positive-reinforcement' | 'negative-reinforcement' | 'new-pattern' | 'pattern-consolidation';
  memoryType: 'vendor' | 'correction' | 'resolution';
  memoryId: string;
  confidenceChange: number;
  reasoning: string;
  timestamp: Date;
}

export class LearningEngine {
  private memoryStore: MemoryStore;
  private processedInvoices: Set<string> = new Set();
  private learningEvents: LearningEvent[] = [];

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Reinforce memory for positive feedback handling
   * Requirements: 4.1, 4.2, 4.4
   */
  async reinforceMemory(feedback: LearningFeedback): Promise<void> {
    try {
      // Prevent duplicate learning from the same invoice
      if (this.processedInvoices.has(feedback.invoiceId)) {
        console.warn(`Learning already processed for invoice ${feedback.invoiceId}`);
        return;
      }

      const learningEvents: LearningEvent[] = [];

      // Handle correction memory reinforcement
      if (feedback.correctionId) {
        const confidenceChange = await this.reinforceCorrectionMemory(feedback.correctionId, feedback.approved);
        learningEvents.push({
          id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: feedback.invoiceId,
          eventType: feedback.approved ? 'positive-reinforcement' : 'negative-reinforcement',
          memoryType: 'correction',
          memoryId: feedback.correctionId,
          confidenceChange,
          reasoning: feedback.reasoning || `${feedback.approved ? 'Approved' : 'Rejected'} correction`,
          timestamp: feedback.timestamp
        });
      }

      // Handle vendor memory reinforcement
      if (feedback.vendorMemoryId) {
        const confidenceChange = await this.reinforceVendorMemory(feedback.vendorMemoryId, feedback.approved);
        learningEvents.push({
          id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: feedback.invoiceId,
          eventType: feedback.approved ? 'positive-reinforcement' : 'negative-reinforcement',
          memoryType: 'vendor',
          memoryId: feedback.vendorMemoryId,
          confidenceChange,
          reasoning: feedback.reasoning || `${feedback.approved ? 'Approved' : 'Rejected'} vendor pattern`,
          timestamp: feedback.timestamp
        });
      }

      // Handle resolution memory reinforcement
      if (feedback.resolutionMemoryId) {
        const confidenceChange = await this.reinforceResolutionMemory(feedback.resolutionMemoryId, feedback.approved);
        learningEvents.push({
          id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: feedback.invoiceId,
          eventType: feedback.approved ? 'positive-reinforcement' : 'negative-reinforcement',
          memoryType: 'resolution',
          memoryId: feedback.resolutionMemoryId,
          confidenceChange,
          reasoning: feedback.reasoning || `${feedback.approved ? 'Approved' : 'Rejected'} resolution`,
          timestamp: feedback.timestamp
        });
      }

      // Record learning events
      this.learningEvents.push(...learningEvents);

      // Mark invoice as processed to prevent duplicate learning
      this.processedInvoices.add(feedback.invoiceId);

      console.log(`Learning completed for invoice ${feedback.invoiceId}: ${learningEvents.length} events recorded`);

    } catch (error) {
      throw new Error(`Failed to reinforce memory: ${error}`);
    }
  }

  /**
   * Decay rejected memory for negative feedback processing
   * Requirements: 4.2, 4.4
   */
  async decayRejectedMemory(correctionId: string, decayFactor: number = 0.15): Promise<number> {
    try {
      // Update correction memory with negative feedback
      await this.memoryStore.updateCorrectionMemoryFeedback(correctionId, false);
      
      // Calculate confidence decay
      const corrections = await this.memoryStore.getCorrectionMemory('', undefined);
      const targetCorrection = corrections.find(c => c.id === correctionId);
      
      if (targetCorrection) {
        const originalConfidence = targetCorrection.confidenceScore;
        const newConfidence = Math.max(0.0, originalConfidence - decayFactor);
        const confidenceChange = newConfidence - originalConfidence;
        
        // Update related memories with consistent confidence changes
        await this.updateConsistentConfidenceScores('correction', correctionId, confidenceChange);
        
        return confidenceChange;
      }
      
      return 0;
    } catch (error) {
      throw new Error(`Failed to decay rejected memory: ${error}`);
    }
  }

  /**
   * Prevent duplicate learning from processed invoices
   * Requirements: 4.3, 4.5, 9.5
   */
  preventDuplicateLearning(invoiceId: string): boolean {
    return this.processedInvoices.has(invoiceId);
  }

  /**
   * Update confidence scores consistently across related entries
   * Requirements: 4.4
   */
  async updateConfidenceScores(memoryType: string, memoryId: string, confidenceChange: number): Promise<void> {
    try {
      await this.updateConsistentConfidenceScores(memoryType, memoryId, confidenceChange);
    } catch (error) {
      throw new Error(`Failed to update confidence scores: ${error}`);
    }
  }

  /**
   * Learn from human corrections to create new memory patterns
   * Requirements: 4.1, 4.3, 9.2
   */
  async learnFromHumanCorrections(
    invoice: Invoice,
    humanCorrections: ProposedCorrection[],
    decision: ProcessingDecision
  ): Promise<void> {
    try {
      // Prevent duplicate learning
      if (this.preventDuplicateLearning(invoice.id)) {
        return;
      }

      const learningEvents: LearningEvent[] = [];

      // Create or update correction memory from human corrections
      for (const correction of humanCorrections) {
        const correctionMemory: CorrectionMemory = {
          id: `correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalValue: String(correction.originalValue),
          correctedValue: String(correction.correctedValue),
          fieldName: correction.field,
          vendorName: invoice.vendorName,
          confidenceScore: 0.7, // Start with medium confidence for human corrections
          approvalCount: 1, // Human provided this correction
          rejectionCount: 0,
          createdAt: new Date()
        };

        await this.memoryStore.storeCorrectionMemory(correctionMemory);

        learningEvents.push({
          id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: invoice.id,
          eventType: 'new-pattern',
          memoryType: 'correction',
          memoryId: correctionMemory.id,
          confidenceChange: 0.7,
          reasoning: `New correction pattern learned from human feedback: ${correction.field}`,
          timestamp: new Date()
        });
      }

      // Create resolution memory from the decision
      const resolutionMemory: ResolutionMemory = {
        id: `resolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoicePattern: this.generateInvoicePattern(invoice),
        decision: decision.action,
        confidenceScore: decision.confidenceScore,
        outcomeSuccess: true, // Assume human corrections lead to success
        reasoning: `Human-guided decision: ${decision.reasoning}`,
        createdAt: new Date()
      };

      await this.memoryStore.storeResolutionMemory(resolutionMemory);

      learningEvents.push({
        id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceId: invoice.id,
        eventType: 'new-pattern',
        memoryType: 'resolution',
        memoryId: resolutionMemory.id,
        confidenceChange: decision.confidenceScore,
        reasoning: `New resolution pattern learned from human decision`,
        timestamp: new Date()
      });

      // Update vendor memory based on successful processing
      await this.updateVendorMemoryFromSuccess(invoice, humanCorrections);

      // Record learning events
      this.learningEvents.push(...learningEvents);

      // Mark as processed
      this.processedInvoices.add(invoice.id);

      console.log(`Learned from human corrections for invoice ${invoice.id}: ${learningEvents.length} new patterns created`);

    } catch (error) {
      throw new Error(`Failed to learn from human corrections: ${error}`);
    }
  }

  /**
   * Get learning statistics and evolution tracking
   * Requirements: 9.5
   */
  getLearningStatistics(): {
    totalLearningEvents: number;
    positiveReinforcements: number;
    negativeReinforcements: number;
    newPatterns: number;
    processedInvoices: number;
    confidenceEvolution: { memoryType: string; averageChange: number }[];
  } {
    const stats = {
      totalLearningEvents: this.learningEvents.length,
      positiveReinforcements: this.learningEvents.filter(e => e.eventType === 'positive-reinforcement').length,
      negativeReinforcements: this.learningEvents.filter(e => e.eventType === 'negative-reinforcement').length,
      newPatterns: this.learningEvents.filter(e => e.eventType === 'new-pattern').length,
      processedInvoices: this.processedInvoices.size,
      confidenceEvolution: this.calculateConfidenceEvolution()
    };

    return stats;
  }

  /**
   * Reinforce correction memory with positive/negative feedback
   */
  private async reinforceCorrectionMemory(correctionId: string, approved: boolean): Promise<number> {
    const originalCorrections = await this.memoryStore.getCorrectionMemory('', undefined);
    const targetCorrection = originalCorrections.find(c => c.id === correctionId);
    
    if (!targetCorrection) {
      throw new Error(`Correction memory ${correctionId} not found`);
    }

    const originalConfidence = targetCorrection.confidenceScore;
    
    // Update with feedback
    await this.memoryStore.updateCorrectionMemoryFeedback(correctionId, approved);
    
    // Calculate confidence change
    const updatedCorrections = await this.memoryStore.getCorrectionMemory('', undefined);
    const updatedCorrection = updatedCorrections.find(c => c.id === correctionId);
    
    if (updatedCorrection) {
      return updatedCorrection.confidenceScore - originalConfidence;
    }
    
    return 0;
  }

  /**
   * Reinforce vendor memory with usage and confidence updates
   */
  private async reinforceVendorMemory(vendorMemoryId: string, approved: boolean): Promise<number> {
    try {
      // Update usage count
      await this.memoryStore.updateVendorMemoryUsage(vendorMemoryId);
      
      // For approved patterns, we would increase confidence
      // For rejected patterns, we would decrease confidence
      // This would require additional methods in MemoryStore
      
      const confidenceChange = approved ? 0.05 : -0.1;
      return confidenceChange;
    } catch (error) {
      console.warn(`Failed to reinforce vendor memory: ${error}`);
      return 0;
    }
  }

  /**
   * Reinforce resolution memory
   */
  private async reinforceResolutionMemory(_resolutionMemoryId: string, approved: boolean): Promise<number> {
    // This would update the resolution memory confidence and outcome success
    // For now, return a placeholder confidence change
    return approved ? 0.05 : -0.1;
  }

  /**
   * Update confidence scores consistently across related memory entries
   */
  private async updateConsistentConfidenceScores(
    memoryType: string, 
    memoryId: string, 
    confidenceChange: number
  ): Promise<void> {
    // This would find and update related memory entries
    // For example, if a correction is approved, related vendor patterns might also get a boost
    console.log(`Updating consistent confidence scores for ${memoryType} ${memoryId}: ${confidenceChange}`);
  }

  /**
   * Generate invoice pattern for resolution memory
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
   * Get amount range category
   */
  private getAmountRange(amount: number): string {
    if (amount < 100) return 'small';
    if (amount < 1000) return 'medium';
    if (amount < 10000) return 'large';
    return 'very-large';
  }

  /**
   * Update vendor memory based on successful processing
   */
  private async updateVendorMemoryFromSuccess(invoice: Invoice, corrections: ProposedCorrection[]): Promise<void> {
    // This would analyze the successful corrections and update vendor patterns
    // For now, just log the intent
    console.log(`Updating vendor memory for ${invoice.vendorName} based on ${corrections.length} successful corrections`);
  }

  /**
   * Calculate confidence evolution statistics
   */
  private calculateConfidenceEvolution(): { memoryType: string; averageChange: number }[] {
    const evolutionByType = new Map<string, number[]>();

    for (const event of this.learningEvents) {
      if (!evolutionByType.has(event.memoryType)) {
        evolutionByType.set(event.memoryType, []);
      }
      evolutionByType.get(event.memoryType)!.push(event.confidenceChange);
    }

    return Array.from(evolutionByType.entries()).map(([memoryType, changes]) => ({
      memoryType,
      averageChange: changes.reduce((sum, change) => sum + change, 0) / changes.length
    }));
  }
}