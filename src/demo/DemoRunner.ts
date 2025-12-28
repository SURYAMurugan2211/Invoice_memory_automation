/**
 * Demo Runner for Invoice Memory Automation System
 * Demonstrates the complete workflow with learning capabilities
 */

import { MemoryStore } from '../models/MemoryStore';
import { RecallEngine } from '../engines/RecallEngine';
import { ApplyEngine } from '../engines/ApplyEngine';
import { DecisionEngine } from '../engines/DecisionEngine';
import { LearningEngine } from '../engines/LearningEngine';
import { OutputEngine } from '../engines/OutputEngine';
import { Invoice, ProposedCorrection } from '../interfaces/Invoice';

export class DemoRunner {
  private memoryStore: MemoryStore;
  private recallEngine: RecallEngine;
  private applyEngine: ApplyEngine;
  private decisionEngine: DecisionEngine;
  private learningEngine: LearningEngine;
  private outputEngine: OutputEngine;

  constructor() {
    this.memoryStore = new MemoryStore(); // No dbPath needed for PostgreSQL
    this.recallEngine = new RecallEngine(this.memoryStore);
    this.applyEngine = new ApplyEngine(this.memoryStore);
    this.decisionEngine = new DecisionEngine();
    this.learningEngine = new LearningEngine(this.memoryStore);
    this.outputEngine = new OutputEngine();
  }

  async runDemo(): Promise<void> {
    console.log('🚀 Starting Invoice Memory Automation Demo\n');

    try {
      // Initialize the system
      await this.memoryStore.initialize();
      console.log('✅ Memory store initialized\n');

      // Demo Phase 1: Process Invoice #1 (no prior memory)
      console.log('📄 PHASE 1: Processing Invoice #1 (Cold Start)');
      console.log('=' .repeat(50));
      
      const invoice1 = this.createSampleInvoice1();
      const result1 = await this.processInvoice(invoice1);
      
      console.log('Invoice #1 Processing Result:');
      console.log(this.outputEngine.toJSON(result1));
      console.log('\n');

      // Demo Phase 2: Human provides corrections
      console.log('👤 PHASE 2: Human Provides Corrections');
      console.log('=' .repeat(50));
      
      const humanCorrections = this.getHumanCorrections();
      await this.learningEngine.learnFromHumanCorrections(invoice1, humanCorrections, {
        action: 'human-review',
        confidenceScore: 0.4,
        reasoning: 'Initial processing with human corrections',
        appliedCorrections: [],
        memorySourceIds: [],
        safetyConstraints: [],
        thresholdAnalysis: {
          autoAcceptThreshold: 0.85,
          autoCorrectThreshold: 0.65,
          humanReviewThreshold: 0.65,
          actualConfidence: 0.4,
          exceedsAutoAccept: false,
          exceedsAutoCorrect: false
        }
      });

      console.log('Human corrections learned:');
      humanCorrections.forEach(correction => {
        console.log(`  - ${correction.field}: "${correction.originalValue}" → "${correction.correctedValue}"`);
      });
      console.log('\n');

      // Demo Phase 3: Process Invoice #2 (with learned memory)
      console.log('📄 PHASE 3: Processing Invoice #2 (With Learning)');
      console.log('=' .repeat(50));
      
      const invoice2 = this.createSampleInvoice2();
      const result2 = await this.processInvoice(invoice2);
      
      console.log('Invoice #2 Processing Result:');
      console.log(this.outputEngine.toJSON(result2));
      console.log('\n');

      // Demo Phase 4: Show learning statistics
      console.log('📊 PHASE 4: Learning Statistics');
      console.log('=' .repeat(50));
      
      const stats = this.learningEngine.getLearningStatistics();
      console.log('Learning Statistics:');
      console.log(`  - Total Learning Events: ${stats.totalLearningEvents}`);
      console.log(`  - Positive Reinforcements: ${stats.positiveReinforcements}`);
      console.log(`  - New Patterns Created: ${stats.newPatterns}`);
      console.log(`  - Processed Invoices: ${stats.processedInvoices}`);
      console.log('\n');

      // Demo Phase 5: Show memory evolution
      console.log('🧠 PHASE 5: Memory Evolution');
      console.log('=' .repeat(50));
      
      const memoryStats = await this.memoryStore.getStats();
      console.log('Memory Store Statistics:');
      console.log(`  - Vendor Memory Patterns: ${memoryStats.vendorMemoryCount}`);
      console.log(`  - Correction Memory Patterns: ${memoryStats.correctionMemoryCount}`);
      console.log(`  - Resolution Memory Patterns: ${memoryStats.resolutionMemoryCount}`);
      console.log(`  - Audit Log Entries: ${memoryStats.auditLogCount}`);
      console.log('\n');

      console.log('🎉 Demo completed successfully!');
      console.log('The system has demonstrated:');
      console.log('  ✓ Cold start processing with human review');
      console.log('  ✓ Learning from human corrections');
      console.log('  ✓ Improved processing with learned patterns');
      console.log('  ✓ Comprehensive audit trail and explainability');
      console.log('  ✓ Memory evolution and statistics tracking');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      await this.memoryStore.close();
    }
  }

  private async processInvoice(invoice: Invoice) {
    // Step 1: Recall relevant memory
    const insights = await this.recallEngine.getConfidenceWeightedInsights(invoice);
    
    // Step 2: Apply normalization and propose corrections
    await this.applyEngine.normalizeInvoiceFields(invoice, insights.vendorPatterns);
    const proposedCorrections = await this.applyEngine.proposeCorrections(invoice, insights.suggestedCorrections);
    
    // Step 3: Make decision
    const decision = await this.decisionEngine.makeProcessingDecision(invoice, insights, proposedCorrections);
    
    // Step 4: Generate output
    const auditLogs = await this.memoryStore.getAuditLogs({ limit: 10 });
    const result = this.outputEngine.createInvoiceProcessingResult(invoice, decision, insights, auditLogs);
    
    return result;
  }

  private createSampleInvoice1(): Invoice {
    return {
      id: 'INV-001',
      vendorName: 'Acme Corp',
      invoiceNumber: 'AC-2024-001',
      amount: 1250.00,
      date: new Date('2024-01-15'),
      lineItems: [
        {
          description: 'Office Supplies',
          quantity: 10,
          unitPrice: 25.00,
          totalPrice: 250.00,
          category: 'supplies'
        },
        {
          description: 'Software License',
          quantity: 1,
          unitPrice: 1000.00,
          totalPrice: 1000.00,
          category: 'software'
        }
      ],
      rawFields: {
        'inv_num': 'AC-2024-001',
        'total_amt': '$1,250.00',
        'vendor_id': 'ACME_CORP',
        'due_date': '2024-02-15',
        'po_number': 'PO-2024-0001'
      },
      processingMetadata: {
        receivedAt: new Date(),
        processingStarted: new Date(),
        memorySourceIds: [],
        humanReviewRequired: false
      }
    };
  }

  private createSampleInvoice2(): Invoice {
    return {
      id: 'INV-002',
      vendorName: 'Acme Corp',
      invoiceNumber: 'AC-2024-002',
      amount: 875.50,
      date: new Date('2024-01-20'),
      lineItems: [
        {
          description: 'Marketing Materials',
          quantity: 5,
          unitPrice: 175.10,
          totalPrice: 875.50,
          category: 'marketing'
        }
      ],
      rawFields: {
        'inv_num': 'AC-2024-002',
        'total_amt': '$875.50',
        'vendor_id': 'ACME_CORP',
        'due_date': '2024-02-20',
        'po_number': 'PO-2024-0002'
      },
      processingMetadata: {
        receivedAt: new Date(),
        processingStarted: new Date(),
        memorySourceIds: [],
        humanReviewRequired: false
      }
    };
  }

  private getHumanCorrections(): ProposedCorrection[] {
    return [
      {
        field: 'vendorName',
        originalValue: 'Acme Corp',
        correctedValue: 'ACME Corporation',
        confidence: 0.9,
        memorySourceId: 'human-correction-1',
        reasoning: 'Human corrected vendor name to official format'
      },
      {
        field: 'total_amt',
        originalValue: '$1,250.00',
        correctedValue: '1250.00',
        confidence: 0.95,
        memorySourceId: 'human-correction-2',
        reasoning: 'Human normalized currency format'
      }
    ];
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  const demo = new DemoRunner();
  demo.runDemo().catch(console.error);
}