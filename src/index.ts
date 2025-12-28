/**
 * Invoice Memory Automation System - Production Entry Point
 * A memory-driven invoice processing system with machine learning capabilities
 */

import { MemoryStore } from './models/MemoryStore';
import { RecallEngine } from './engines/RecallEngine';
import { ApplyEngine } from './engines/ApplyEngine';
import { DecisionEngine } from './engines/DecisionEngine';
import { LearningEngine, LearningFeedback } from './engines/LearningEngine';
import { OutputEngine } from './engines/OutputEngine';
import { Invoice, ProposedCorrection } from './interfaces/Invoice';
import { InvoiceProcessingResult } from './interfaces/Output';

/**
 * Main Invoice Memory Automation System Class
 */
export class InvoiceMemorySystem {
  private memoryStore: MemoryStore;
  private recallEngine: RecallEngine;
  private applyEngine: ApplyEngine;
  private decisionEngine: DecisionEngine;
  private learningEngine: LearningEngine;
  private outputEngine: OutputEngine;
  private initialized: boolean = false;

  constructor() {
    this.memoryStore = new MemoryStore();
    this.recallEngine = new RecallEngine(this.memoryStore);
    this.applyEngine = new ApplyEngine(this.memoryStore);
    this.decisionEngine = new DecisionEngine();
    this.learningEngine = new LearningEngine(this.memoryStore);
    this.outputEngine = new OutputEngine();
  }

  /**
   * Initialize the system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.memoryStore.initialize();
      this.initialized = true;
      console.log('✅ Invoice Memory Automation System initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize system:', error);
      throw error;
    }
  }

  /**
   * Process an invoice through the complete memory-driven pipeline
   */
  async processInvoice(invoice: Invoice): Promise<InvoiceProcessingResult> {
    if (!this.initialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      // Step 1: Recall relevant memory patterns
      const memoryInsights = await this.recallEngine.getConfidenceWeightedInsights(invoice);

      // Step 2: Get vendor memory for normalization
      const vendorMemory = await this.recallEngine.getVendorMemory(invoice.vendorName);

      // Step 3: Apply field normalization
      const normalizedInvoice = await this.applyEngine.normalizeInvoiceFields(invoice, vendorMemory);

      // Step 4: Get correction memory for proposals
      const correctionMemory = await this.recallEngine.getCorrectionMemory('', invoice.vendorName);
      const proposedCorrections = await this.applyEngine.proposeCorrections(invoice, correctionMemory);

      // Step 5: Make processing decision based on confidence
      const decision = await this.decisionEngine.makeProcessingDecision(
        normalizedInvoice,
        memoryInsights,
        proposedCorrections
      );

      // Step 6: Format output
      const result = this.outputEngine.createInvoiceProcessingResult(
        invoice,
        decision,
        memoryInsights
      );

      return result;
    } catch (error) {
      console.error('❌ Error processing invoice:', error);
      throw error;
    }
  }

  /**
   * Learn from human corrections to improve future processing
   */
  async learnFromCorrections(invoiceId: string, corrections: ProposedCorrection[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      // Create learning feedback from corrections
      const feedback: LearningFeedback = {
        invoiceId,
        correctionId: corrections[0]?.memorySourceId || `correction_${Date.now()}`,
        approved: true,
        reasoning: `Learning from ${corrections.length} human corrections`,
        timestamp: new Date()
      };

      await this.learningEngine.reinforceMemory(feedback);
      console.log(`✅ Learned from ${corrections.length} corrections for invoice ${invoiceId}`);
    } catch (error) {
      console.error('❌ Error learning from corrections:', error);
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    memoryStats: {
      vendorMemoryCount: number;
      correctionMemoryCount: number;
      resolutionMemoryCount: number;
      auditLogCount: number;
    };
    isInitialized: boolean;
  }> {
    if (!this.initialized) {
      return {
        memoryStats: {
          vendorMemoryCount: 0,
          correctionMemoryCount: 0,
          resolutionMemoryCount: 0,
          auditLogCount: 0
        },
        isInitialized: false
      };
    }

    const memoryStats = await this.memoryStore.getStats();
    return {
      memoryStats,
      isInitialized: this.initialized
    };
  }

  /**
   * Close the system and clean up resources
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.memoryStore.close();
      this.initialized = false;
      console.log('✅ Invoice Memory Automation System closed');
    }
  }
}

// Export the main class and demo runner for backward compatibility
export { DemoRunner } from './demo/DemoRunner';

/**
 * Main function for running the system demo
 */
async function main() {
  console.log('🚀 Invoice Memory Automation System - Production Demo');
  console.log('====================================================\n');
  
  try {
    // Import and run demo
    const { DemoRunner } = await import('./demo/DemoRunner');
    const demo = new DemoRunner();
    await demo.runDemo();
    
    console.log('\n✅ System demonstration completed successfully!');
    console.log('📊 The Invoice Memory Automation System is ready for production deployment.');
    
  } catch (error) {
    console.error('❌ System error:', error);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  main();
}