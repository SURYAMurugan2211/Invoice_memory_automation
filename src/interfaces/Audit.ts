/**
 * Audit trail and logging interfaces
 */

export interface AuditLog {
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