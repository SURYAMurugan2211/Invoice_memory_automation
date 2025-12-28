# Design Document

## Overview

The Invoice Memory Automation System is a TypeScript/Node.js application that processes invoices using heuristic-based learning without machine learning models. The system maintains confidence-scored memory patterns in SQLite and provides explainable reasoning for all decisions. The architecture emphasizes modularity, type safety, and auditability.

## Architecture

The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Demo Runner   │    │  Output Contract│    │   Audit Trail   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
┌─────────────────────────────────────────────────────────────────┐
│                    Decision Engine                              │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Recall Engine  │    │  Apply Engine   │    │ Learning Engine │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
┌─────────────────────────────────────────────────────────────────┐
│                      Memory Store (SQLite)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Memory Store
**Purpose**: Persistent storage layer using SQLite for all memory operations.

**Key Interfaces**:
```typescript
interface VendorMemory {
  id: string;
  vendorName: string;
  fieldMappings: Record<string, string>;
  normalizationRules: NormalizationRule[];
  confidenceScore: number;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

interface CorrectionMemory {
  id: string;
  originalValue: string;
  correctedValue: string;
  fieldName: string;
  vendorName?: string;
  confidenceScore: number;
  approvalCount: number;
  rejectionCount: number;
  createdAt: Date;
}

interface ResolutionMemory {
  id: string;
  invoicePattern: string;
  decision: 'auto-accept' | 'auto-correct' | 'human-review';
  confidenceScore: number;
  outcomeSuccess: boolean;
  reasoning: string;
  createdAt: Date;
}

interface AuditLog {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  reasoning: string;
  confidenceScore?: number;
  timestamp: Date;
}
```

### Recall Engine
**Purpose**: Retrieves relevant memory patterns with confidence weighting.

**Key Methods**:
- `getVendorMemory(vendorName: string): Promise<VendorMemory[]>`
- `getCorrectionMemory(fieldName: string, value: string): Promise<CorrectionMemory[]>`
- `getResolutionMemory(invoicePattern: string): Promise<ResolutionMemory[]>`
- `getConfidenceWeightedInsights(invoice: Invoice): Promise<MemoryInsights>`

### Apply Engine
**Purpose**: Applies memory patterns to normalize and correct invoice data.

**Key Methods**:
- `normalizeInvoiceFields(invoice: Invoice, vendorMemory: VendorMemory[]): Promise<NormalizedInvoice>`
- `proposeCorrections(invoice: Invoice, correctionMemory: CorrectionMemory[]): Promise<ProposedCorrection[]>`
- `applyHighConfidenceCorrections(invoice: Invoice, corrections: ProposedCorrection[]): Promise<CorrectedInvoice>`

### Decision Engine
**Purpose**: Makes processing decisions based on confidence thresholds with explainable reasoning.

**Configuration**:
- Auto-accept threshold: 0.85
- Auto-correct threshold: 0.65
- Human review threshold: < 0.65

**Key Methods**:
- `makeProcessingDecision(invoice: Invoice, insights: MemoryInsights): Promise<ProcessingDecision>`
- `generateExplanation(decision: ProcessingDecision): string`
- `evaluateConfidenceThresholds(confidenceScore: number): DecisionType`

### Learning Engine
**Purpose**: Updates memory based on human feedback and prevents duplicate learning.

**Key Methods**:
- `reinforceMemory(correctionId: string, approved: boolean): Promise<void>`
- `decayRejectedMemory(correctionId: string): Promise<void>`
- `preventDuplicateLearning(invoiceId: string): Promise<boolean>`
- `updateConfidenceScores(memoryType: string, feedback: Feedback): Promise<void>`

## Data Models

### Core Invoice Structure
```typescript
interface Invoice {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  date: Date;
  lineItems: LineItem[];
  rawFields: Record<string, any>;
  processingMetadata: ProcessingMetadata;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

interface ProcessingMetadata {
  receivedAt: Date;
  processingStarted: Date;
  confidenceScore?: number;
  memorySourceIds: string[];
  humanReviewRequired: boolean;
}
```

### Memory Pattern Structures
```typescript
interface NormalizationRule {
  fieldName: string;
  pattern: string;
  replacement: string;
  confidenceScore: number;
}

interface MemoryInsights {
  vendorPatterns: VendorMemory[];
  suggestedCorrections: CorrectionMemory[];
  historicalResolutions: ResolutionMemory[];
  overallConfidence: number;
  reasoning: string[];
}

interface ProcessingDecision {
  action: 'auto-accept' | 'auto-correct' | 'human-review';
  confidenceScore: number;
  reasoning: string;
  appliedCorrections: ProposedCorrection[];
  memorySourceIds: string[];
}
```

### Output Contract
```typescript
interface InvoiceProcessingResult {
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
```
## Corr
ectness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Memory Persistence Properties

**Property 1: Invoice processing creates persistent vendor patterns**
*For any* invoice processed by the system, vendor patterns should be persisted in the Memory_Store with valid confidence scores between 0 and 1
**Validates: Requirements 1.1**

**Property 2: Vendor pattern completeness**
*For any* vendor pattern stored in the Memory_Store, it should contain both normalization rules and field mappings
**Validates: Requirements 1.2**

**Property 3: Confidence-weighted memory retrieval**
*For any* vendor memory retrieval operation, results should be ordered by confidence score in descending order
**Validates: Requirements 1.3**

**Property 4: Memory access audit trail**
*For any* vendor memory access operation, a corresponding audit log entry should be created with timestamp and operation details
**Validates: Requirements 1.4**

**Property 5: Vendor pattern deduplication**
*For any* duplicate vendor patterns detected, they should be consolidated into a single pattern with updated confidence score
**Validates: Requirements 1.5**

### Database Integrity Properties

**Property 6: ACID compliance for memory operations**
*For any* concurrent memory write operations, the final database state should be consistent and reflect all committed transactions
**Validates: Requirements 2.2**

**Property 7: Data persistence across restarts**
*For any* memory data written before system shutdown, it should remain accessible after system restart
**Validates: Requirements 2.3**

**Property 8: Database error handling**
*For any* database operation that fails, the system should return appropriate error responses without corrupting existing data
**Validates: Requirements 2.4**

### Explainability Properties

**Property 9: Decision reasoning completeness**
*For any* processing decision made by the Decision_Engine, it should include both detailed reasoning and confidence scores
**Validates: Requirements 3.1**

**Property 10: Memory pattern traceability**
*For any* memory pattern applied to an invoice, the explanation should reference the specific historical patterns that influenced the decision
**Validates: Requirements 3.2**

**Property 11: Correction memory references**
*For any* correction proposed by the system, it should include references to specific correction memory entries that support the recommendation
**Validates: Requirements 3.3**

**Property 12: Threshold decision explanations**
*For any* confidence threshold evaluation, the Decision_Engine should provide reasoning for why auto-accept, auto-correct, or human review was chosen
**Validates: Requirements 3.4**

**Property 13: Complete audit reasoning chains**
*For any* audit trail generated, it should include complete reasoning chains for all decisions made during processing
**Validates: Requirements 3.5**

### Learning Properties

**Property 14: Positive reinforcement learning**
*For any* human correction that approves a system decision, the confidence scores of related memory patterns should increase
**Validates: Requirements 4.1**

**Property 15: Negative reinforcement learning**
*For any* human correction that contradicts a system decision, the confidence scores of rejected patterns should decrease
**Validates: Requirements 4.2**

**Property 16: Duplicate learning prevention**
*For any* invoice that has already been used for learning, subsequent learning attempts should be prevented
**Validates: Requirements 4.3**

**Property 17: Consistent confidence updates**
*For any* confidence score change in a memory pattern, all related memory entries should be updated consistently
**Validates: Requirements 4.4**

**Property 18: Learning audit trail**
*For any* learning operation performed, a corresponding audit log entry should be created documenting the learning event
**Validates: Requirements 4.5**

### Field Normalization Properties

**Property 19: Vendor-specific normalization**
*For any* invoice processed, field normalization should use vendor-specific memory patterns when available
**Validates: Requirements 5.1**

**Property 20: Confidence-weighted field mappings**
*For any* field mapping application, mappings with higher confidence scores should take precedence over lower confidence mappings
**Validates: Requirements 5.2**

**Property 21: Original value preservation**
*For any* field normalization operation, the original field values should remain accessible for audit purposes
**Validates: Requirements 5.3**

**Property 22: Highest confidence pattern selection**
*For any* conflicting normalization patterns, the pattern with the highest confidence score should be applied
**Validates: Requirements 5.4**

**Property 23: Normalization failure handling**
*For any* normalization operation that fails, the invoice should be flagged for human review with detailed error information
**Validates: Requirements 5.5**

### Decision Threshold Properties

**Property 24: Auto-accept threshold behavior**
*For any* confidence score above the auto-accept threshold (0.85), the Decision_Engine should automatically process the invoice
**Validates: Requirements 6.1**

**Property 25: Auto-correct threshold behavior**
*For any* confidence score between auto-correct (0.65) and auto-accept (0.85) thresholds, the Decision_Engine should propose corrections for human review
**Validates: Requirements 6.2**

**Property 26: Human review threshold behavior**
*For any* confidence score below the human review threshold (0.65), the Decision_Engine should require full human review
**Validates: Requirements 6.3**

**Property 27: Low confidence correction safety**
*For any* correction with confidence score below the auto-correct threshold, it should never be auto-applied
**Validates: Requirements 6.4**

**Property 28: Threshold reasoning provision**
*For any* threshold evaluation, the Decision_Engine should provide reasoning for the chosen action path
**Validates: Requirements 6.5**

### Audit Trail Properties

**Property 29: Comprehensive operation logging**
*For any* system operation performed, it should be recorded in audit_logs with accurate timestamps
**Validates: Requirements 7.1**

**Property 30: Decision audit completeness**
*For any* decision made, the audit trail should include confidence scores, reasoning, and memory source references
**Validates: Requirements 7.2**

**Property 31: Memory modification tracking**
*For any* memory modification, the audit trail should record both before and after states with change reasons
**Validates: Requirements 7.3**

**Property 32: Audit query filtering**
*For any* audit trail query with filters (invoice, vendor, operation type, time range), only matching results should be returned
**Validates: Requirements 7.4**

**Property 33: Audit data integrity**
*For any* audit data retrieval, the data should maintain integrity and prevent unauthorized modifications
**Validates: Requirements 7.5**

### Output Contract Properties

**Property 34: JSON structure compliance**
*For any* processing result generated, the output should conform exactly to the specified JSON contract structure
**Validates: Requirements 8.1**

**Property 35: Confidence score range validation**
*For any* confidence score included in output, it should be a numerical value between 0 and 1 inclusive
**Validates: Requirements 8.2**

**Property 36: Structured reasoning fields**
*For any* reasoning provided in output, it should include properly structured explanation fields
**Validates: Requirements 8.3**

**Property 37: Error format consistency**
*For any* error that occurs, the output should maintain the contract format while including appropriate error indicators
**Validates: Requirements 8.4**

**Property 38: JSON serialization round trip**
*For any* valid processing result, serializing then deserializing should produce an equivalent object
**Validates: Requirements 8.5**

### Learning Demonstration Properties

**Property 39: Demo correction storage**
*For any* human correction provided during demo, it should be stored in memory with appropriate confidence levels
**Validates: Requirements 9.2**

**Property 40: Learning improvement demonstration**
*For any* second invoice processed after learning, decision-making should show measurable improvement using learned patterns
**Validates: Requirements 9.3**

**Property 41: Quantifiable learning improvement**
*For any* learning demonstration, there should be measurable improvement in confidence scores and decision accuracy
**Validates: Requirements 9.5**

## Error Handling

The system implements comprehensive error handling across all components:

### Database Errors
- Connection failures: Retry with exponential backoff
- Transaction conflicts: Rollback and retry with jitter
- Schema errors: Graceful degradation with logging
- Disk space issues: Alert and prevent further writes

### Memory Operation Errors
- Invalid confidence scores: Clamp to valid range [0,1]
- Missing vendor patterns: Use default patterns with low confidence
- Corrupted memory data: Quarantine and log for manual review
- Concurrent modification: Use optimistic locking with retry

### Processing Errors
- Invalid invoice format: Flag for human review with detailed errors
- Normalization failures: Preserve original data and flag issues
- Confidence calculation errors: Use conservative fallback values
- Decision engine failures: Default to human review requirement

### Learning Errors
- Duplicate learning attempts: Silently ignore with audit log
- Invalid feedback: Log error and request clarification
- Confidence update failures: Rollback transaction and retry
- Memory corruption: Restore from backup and alert administrators

## Testing Strategy

The system employs a dual testing approach combining unit tests and property-based tests to ensure comprehensive coverage and correctness validation.

### Unit Testing Approach
Unit tests verify specific examples, edge cases, and integration points:
- Database connection and schema initialization
- Individual component method behavior
- Error handling for specific failure scenarios
- Integration between components
- Demo runner workflow execution

### Property-Based Testing Approach
Property-based tests verify universal properties across all inputs using **fast-check** library:
- Each property-based test runs a minimum of 100 iterations
- Tests generate random invoices, vendor patterns, and correction scenarios
- Validates that correctness properties hold across all generated inputs
- Each test is tagged with format: **Feature: invoice-memory-automation, Property {number}: {property_text}**
- Tests focus on invariants, round-trip properties, and behavioral consistency

### Test Configuration
- Property-based testing library: **fast-check** for TypeScript/Node.js
- Minimum iterations per property test: 100
- Test data generators for invoices, vendors, corrections, and memory patterns
- Confidence score generators constrained to valid range [0,1]
- Database state generators for testing persistence and consistency

### Coverage Requirements
- All correctness properties must have corresponding property-based tests
- Critical paths must have both unit and property tests
- Error conditions must be tested with both approaches
- Integration points require comprehensive test coverage
- Demo scenarios must be validated through automated tests