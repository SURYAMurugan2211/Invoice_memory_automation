/**
 * Decision Engine with confidence thresholds
 * Makes processing decisions based on confidence scores and safety constraints
 */

import { MemoryInsights } from '../interfaces/Memory';
import { Invoice, ProposedCorrection } from '../interfaces/Invoice';

export interface ProcessingDecision {
  action: 'auto-accept' | 'auto-correct' | 'human-review';
  confidenceScore: number;
  reasoning: string;
  appliedCorrections: ProposedCorrection[];
  memorySourceIds: string[];
  safetyConstraints: string[];
  thresholdAnalysis: {
    autoAcceptThreshold: number;
    autoCorrectThreshold: number;
    humanReviewThreshold: number;
    actualConfidence: number;
    exceedsAutoAccept: boolean;
    exceedsAutoCorrect: boolean;
  };
}

export interface DecisionThresholds {
  autoAccept: number;
  autoCorrect: number;
  humanReview: number;
}

export class DecisionEngine {
  private thresholds: DecisionThresholds;

  constructor(thresholds?: Partial<DecisionThresholds>) {
    // Default thresholds as specified in design
    this.thresholds = {
      autoAccept: 0.85,
      autoCorrect: 0.65,
      humanReview: 0.65, // Below this requires human review
      ...thresholds
    };
  }

  /**
   * Make processing decision with configurable thresholds
   * Requirements: 6.1, 6.2, 6.3, 3.1, 3.4
   */
  async makeProcessingDecision(
    _invoice: Invoice, 
    insights: MemoryInsights,
    proposedCorrections: ProposedCorrection[] = []
  ): Promise<ProcessingDecision> {
    try {
      const confidenceScore = insights.overallConfidence;
      const memorySourceIds = this.extractMemorySourceIds(insights, proposedCorrections);
      
      // Evaluate confidence thresholds
      const thresholdAnalysis = this.evaluateConfidenceThresholds(confidenceScore);
      
      // Apply safety constraints
      const safetyConstraints = this.applySafetyConstraints(proposedCorrections, confidenceScore);
      
      // Determine action based on thresholds and safety constraints
      const action = this.determineAction(thresholdAnalysis, safetyConstraints, proposedCorrections);
      
      // Filter corrections based on action and safety constraints
      const appliedCorrections = this.filterCorrectionsForAction(action, proposedCorrections, safetyConstraints);
      
      // Generate comprehensive reasoning
      const reasoning = this.generateExplanation({
        action,
        confidenceScore,
        thresholdAnalysis,
        safetyConstraints,
        appliedCorrections,
        insights,
        proposedCorrections
      });

      return {
        action,
        confidenceScore,
        reasoning,
        appliedCorrections,
        memorySourceIds,
        safetyConstraints,
        thresholdAnalysis
      };
    } catch (error) {
      // Fallback to human review on any error
      return {
        action: 'human-review',
        confidenceScore: 0,
        reasoning: `Error in decision processing: ${error}. Defaulting to human review for safety.`,
        appliedCorrections: [],
        memorySourceIds: [],
        safetyConstraints: ['error-fallback'],
        thresholdAnalysis: {
          autoAcceptThreshold: this.thresholds.autoAccept,
          autoCorrectThreshold: this.thresholds.autoCorrect,
          humanReviewThreshold: this.thresholds.humanReview,
          actualConfidence: 0,
          exceedsAutoAccept: false,
          exceedsAutoCorrect: false
        }
      };
    }
  }

  /**
   * Evaluate confidence thresholds
   * Requirements: 6.1, 6.2, 6.3
   */
  evaluateConfidenceThresholds(confidenceScore: number): ProcessingDecision['thresholdAnalysis'] {
    return {
      autoAcceptThreshold: this.thresholds.autoAccept,
      autoCorrectThreshold: this.thresholds.autoCorrect,
      humanReviewThreshold: this.thresholds.humanReview,
      actualConfidence: confidenceScore,
      exceedsAutoAccept: confidenceScore >= this.thresholds.autoAccept,
      exceedsAutoCorrect: confidenceScore >= this.thresholds.autoCorrect
    };
  }

  /**
   * Generate detailed explanation for decision
   * Requirements: 3.1, 3.4, 3.5
   */
  generateExplanation(context: {
    action: ProcessingDecision['action'];
    confidenceScore: number;
    thresholdAnalysis: ProcessingDecision['thresholdAnalysis'];
    safetyConstraints: string[];
    appliedCorrections: ProposedCorrection[];
    insights: MemoryInsights;
    proposedCorrections: ProposedCorrection[];
  }): string {
    const { action, confidenceScore, thresholdAnalysis, safetyConstraints, appliedCorrections, insights, proposedCorrections } = context;
    
    const explanationParts: string[] = [];

    // Confidence analysis
    explanationParts.push(
      `Confidence Analysis: Overall confidence score is ${(confidenceScore * 100).toFixed(1)}% ` +
      `(Auto-accept: ≥${(thresholdAnalysis.autoAcceptThreshold * 100).toFixed(0)}%, ` +
      `Auto-correct: ≥${(thresholdAnalysis.autoCorrectThreshold * 100).toFixed(0)}%, ` +
      `Human review: <${(thresholdAnalysis.humanReviewThreshold * 100).toFixed(0)}%)`
    );

    // Memory insights summary
    explanationParts.push(
      `Memory Insights: Found ${insights.vendorPatterns.length} vendor pattern(s), ` +
      `${insights.suggestedCorrections.length} correction suggestion(s), ` +
      `${insights.historicalResolutions.length} historical resolution(s)`
    );

    // Threshold evaluation
    if (thresholdAnalysis.exceedsAutoAccept) {
      explanationParts.push(`✓ Exceeds auto-accept threshold (${(thresholdAnalysis.autoAcceptThreshold * 100).toFixed(0)}%)`);
    } else if (thresholdAnalysis.exceedsAutoCorrect) {
      explanationParts.push(`✓ Exceeds auto-correct threshold (${(thresholdAnalysis.autoCorrectThreshold * 100).toFixed(0)}%)`);
    } else {
      explanationParts.push(`✗ Below auto-correct threshold, requires human review`);
    }

    // Safety constraints
    if (safetyConstraints.length > 0) {
      explanationParts.push(`Safety Constraints Applied: ${safetyConstraints.join(', ')}`);
    }

    // Corrections analysis
    if (proposedCorrections.length > 0) {
      const highConfidenceCorrections = proposedCorrections.filter(c => c.confidence >= this.thresholds.autoAccept);
      const mediumConfidenceCorrections = proposedCorrections.filter(c => 
        c.confidence >= this.thresholds.autoCorrect && c.confidence < this.thresholds.autoAccept
      );
      
      explanationParts.push(
        `Corrections: ${proposedCorrections.length} proposed ` +
        `(${highConfidenceCorrections.length} high-confidence, ${mediumConfidenceCorrections.length} medium-confidence)`
      );
    }

    // Action reasoning
    switch (action) {
      case 'auto-accept':
        explanationParts.push(
          `Decision: AUTO-ACCEPT - High confidence (${(confidenceScore * 100).toFixed(1)}%) ` +
          `with ${appliedCorrections.length} applied correction(s). Processing automatically.`
        );
        break;
      case 'auto-correct':
        explanationParts.push(
          `Decision: AUTO-CORRECT - Medium confidence (${(confidenceScore * 100).toFixed(1)}%) ` +
          `with ${appliedCorrections.length} proposed correction(s). Corrections applied, human review recommended.`
        );
        break;
      case 'human-review':
        explanationParts.push(
          `Decision: HUMAN-REVIEW - Low confidence (${(confidenceScore * 100).toFixed(1)}%) ` +
          `or safety constraints require human oversight.`
        );
        break;
    }

    // Detailed reasoning from memory insights
    if (insights.reasoning.length > 0) {
      explanationParts.push(`Memory Analysis: ${insights.reasoning.join('; ')}`);
    }

    return explanationParts.join(' | ');
  }

  /**
   * Apply safety constraints for auto-corrections
   * Requirements: 6.4, 6.5, 3.5
   */
  private applySafetyConstraints(proposedCorrections: ProposedCorrection[], confidenceScore: number): string[] {
    const constraints: string[] = [];

    // Never auto-apply corrections with low confidence scores
    const lowConfidenceCorrections = proposedCorrections.filter(c => c.confidence < this.thresholds.autoCorrect);
    if (lowConfidenceCorrections.length > 0) {
      constraints.push(`low-confidence-corrections-blocked`);
    }

    // Limit number of corrections that can be auto-applied
    const highConfidenceCorrections = proposedCorrections.filter(c => c.confidence >= this.thresholds.autoAccept);
    if (highConfidenceCorrections.length > 5) {
      constraints.push(`too-many-corrections`);
    }

    // Block auto-correction of critical fields with medium confidence
    const criticalFieldCorrections = proposedCorrections.filter(c => 
      ['amount', 'vendorName', 'invoiceNumber'].includes(c.field) && 
      c.confidence < this.thresholds.autoAccept
    );
    if (criticalFieldCorrections.length > 0) {
      constraints.push(`critical-field-protection`);
    }

    // Require human review for large value changes
    const largeValueChanges = proposedCorrections.filter(c => {
      if (c.field === 'amount' && typeof c.originalValue === 'number' && typeof c.correctedValue === 'number') {
        const changePercent = Math.abs(c.correctedValue - c.originalValue) / c.originalValue;
        return changePercent > 0.2; // 20% change threshold
      }
      return false;
    });
    if (largeValueChanges.length > 0) {
      constraints.push(`large-value-change`);
    }

    // Overall confidence too low for any auto-correction
    if (confidenceScore < this.thresholds.humanReview) {
      constraints.push(`overall-low-confidence`);
    }

    return constraints;
  }

  /**
   * Determine action based on thresholds and safety constraints
   */
  private determineAction(
    thresholdAnalysis: ProcessingDecision['thresholdAnalysis'],
    safetyConstraints: string[],
    proposedCorrections: ProposedCorrection[]
  ): ProcessingDecision['action'] {
    // Safety constraints override confidence thresholds
    const blockingConstraints = [
      'too-many-corrections',
      'critical-field-protection',
      'large-value-change',
      'overall-low-confidence',
      'error-fallback'
    ];

    if (safetyConstraints.some(constraint => blockingConstraints.includes(constraint))) {
      return 'human-review';
    }

    // High confidence with safe corrections
    if (thresholdAnalysis.exceedsAutoAccept) {
      const safeCorrections = proposedCorrections.filter(c => 
        c.confidence >= this.thresholds.autoAccept &&
        !['amount', 'vendorName', 'invoiceNumber'].includes(c.field)
      );
      
      if (proposedCorrections.length === 0 || safeCorrections.length > 0) {
        return 'auto-accept';
      }
    }

    // Medium confidence
    if (thresholdAnalysis.exceedsAutoCorrect) {
      return 'auto-correct';
    }

    // Low confidence
    return 'human-review';
  }

  /**
   * Filter corrections based on action and safety constraints
   */
  private filterCorrectionsForAction(
    action: ProcessingDecision['action'],
    proposedCorrections: ProposedCorrection[],
    safetyConstraints: string[]
  ): ProposedCorrection[] {
    switch (action) {
      case 'auto-accept':
        // Only apply high-confidence, non-critical field corrections
        return proposedCorrections.filter(c => 
          c.confidence >= this.thresholds.autoAccept &&
          !['amount', 'vendorName', 'invoiceNumber'].includes(c.field) &&
          !safetyConstraints.includes('low-confidence-corrections-blocked')
        );
      
      case 'auto-correct':
        // Apply medium to high confidence corrections, respecting safety constraints
        return proposedCorrections.filter(c => 
          c.confidence >= this.thresholds.autoCorrect &&
          !safetyConstraints.includes('critical-field-protection') &&
          !safetyConstraints.includes('large-value-change')
        );
      
      case 'human-review':
      default:
        // No corrections applied, all require human review
        return [];
    }
  }

  /**
   * Extract memory source IDs from insights and corrections
   */
  private extractMemorySourceIds(insights: MemoryInsights, corrections: ProposedCorrection[]): string[] {
    const sourceIds = new Set<string>();

    // Add vendor pattern IDs
    insights.vendorPatterns.forEach(pattern => sourceIds.add(pattern.id));
    
    // Add correction memory IDs
    insights.suggestedCorrections.forEach(correction => sourceIds.add(correction.id));
    
    // Add resolution memory IDs
    insights.historicalResolutions.forEach(resolution => sourceIds.add(resolution.id));
    
    // Add correction source IDs
    corrections.forEach(correction => sourceIds.add(correction.memorySourceId));

    return Array.from(sourceIds);
  }

  /**
   * Update decision thresholds
   */
  updateThresholds(newThresholds: Partial<DecisionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): DecisionThresholds {
    return { ...this.thresholds };
  }
}