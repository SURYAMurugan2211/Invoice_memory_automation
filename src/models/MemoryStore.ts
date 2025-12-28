/**
 * Memory Store implementation with PostgreSQL persistence
 * Handles database schema, connections, and CRUD operations for all memory types
 */

import { Pool, PoolClient } from 'pg';
import { VendorMemory, CorrectionMemory, ResolutionMemory } from '../interfaces/Memory';
import { AuditLog } from '../interfaces/Audit';
import { createDatabasePool, ensureDatabaseExists } from '../config/database';

export class MemoryStore {
  private pool: Pool | null = null;

  constructor() {
    // PostgreSQL uses connection pooling, no need for dbPath
  }

  /**
   * Initialize database connection pool and create schema
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database exists
      await ensureDatabaseExists();
      
      // Create connection pool
      this.pool = createDatabasePool();
      
      // Test connection
      const client = await this.pool.connect();
      client.release();
      
      // Create schema
      await this.createSchema();
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create database schema for all memory tables
   */
  private async createSchema(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create vendor_memory table
      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor_memory (
          id TEXT PRIMARY KEY,
          vendor_name TEXT NOT NULL,
          field_mappings JSONB NOT NULL,
          normalization_rules JSONB NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
          usage_count INTEGER NOT NULL DEFAULT 0,
          last_used TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          UNIQUE(vendor_name, field_mappings)
        )
      `);

      // Create correction_memory table
      await client.query(`
        CREATE TABLE IF NOT EXISTS correction_memory (
          id TEXT PRIMARY KEY,
          original_value TEXT NOT NULL,
          corrected_value TEXT NOT NULL,
          field_name TEXT NOT NULL,
          vendor_name TEXT,
          confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
          approval_count INTEGER NOT NULL DEFAULT 0,
          rejection_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // Create resolution_memory table
      await client.query(`
        CREATE TABLE IF NOT EXISTS resolution_memory (
          id TEXT PRIMARY KEY,
          invoice_pattern TEXT NOT NULL,
          decision TEXT NOT NULL CHECK (decision IN ('auto-accept', 'auto-correct', 'human-review')),
          confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
          outcome_success BOOLEAN NOT NULL,
          reasoning TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // Create audit_logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          before_state JSONB,
          after_state JSONB,
          reasoning TEXT NOT NULL,
          confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // Create indexes for performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_vendor_memory_vendor_name ON vendor_memory(vendor_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_vendor_memory_confidence ON vendor_memory(confidence_score DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_correction_memory_field ON correction_memory(field_name, vendor_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_correction_memory_confidence ON correction_memory(confidence_score DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_resolution_memory_pattern ON resolution_memory(invoice_pattern)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a database client from the pool
   */
  private async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query with transaction support and error handling
   */
  private async executeInTransaction<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Check if database pool is initialized and connected
   */
  isConnected(): boolean {
    return this.pool !== null;
  }

  /**
   * Execute operation in transaction (used by CRUD operations)
   */
  async runInTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.executeInTransaction(operation);
  }

  // ==================== VENDOR MEMORY OPERATIONS ====================

  /**
   * Store vendor memory with audit logging
   */
  async storeVendorMemory(vendorMemory: VendorMemory): Promise<void> {
    return this.runInTransaction(async (client) => {
      // Insert vendor memory using PostgreSQL syntax
      await client.query(`
        INSERT INTO vendor_memory (
          id, vendor_name, field_mappings, normalization_rules, 
          confidence_score, usage_count, last_used, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          vendor_name = EXCLUDED.vendor_name,
          field_mappings = EXCLUDED.field_mappings,
          normalization_rules = EXCLUDED.normalization_rules,
          confidence_score = EXCLUDED.confidence_score,
          usage_count = EXCLUDED.usage_count,
          last_used = EXCLUDED.last_used
      `, [
        vendorMemory.id,
        vendorMemory.vendorName,
        JSON.stringify(vendorMemory.fieldMappings),
        JSON.stringify(vendorMemory.normalizationRules),
        vendorMemory.confidenceScore,
        vendorMemory.usageCount,
        vendorMemory.lastUsed,
        vendorMemory.createdAt
      ]);

      // Log the operation
      await this.logAuditEntry(client, {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'store_vendor_memory',
        entityType: 'vendor_memory',
        entityId: vendorMemory.id,
        afterState: vendorMemory,
        reasoning: `Stored vendor memory for ${vendorMemory.vendorName}`,
        confidenceScore: vendorMemory.confidenceScore,
        timestamp: new Date()
      });
    });
  }

  /**
   * Retrieve vendor memory by vendor name
   */
  async getVendorMemory(vendorName: string): Promise<VendorMemory[]> {
    const client = await this.getClient();
    
    try {
      const result = await client.query(`
        SELECT * FROM vendor_memory 
        WHERE vendor_name = $1 
        ORDER BY confidence_score DESC, last_used DESC
      `, [vendorName]);

      const vendorMemories = result.rows.map(row => ({
        id: row.id,
        vendorName: row.vendor_name,
        fieldMappings: row.field_mappings,
        normalizationRules: row.normalization_rules,
        confidenceScore: parseFloat(row.confidence_score),
        usageCount: row.usage_count,
        lastUsed: new Date(row.last_used),
        createdAt: new Date(row.created_at)
      }));

      // Log access for audit trail
      await this.logMemoryAccess('vendor_memory', vendorName, vendorMemories.length);
      
      return vendorMemories;
    } finally {
      client.release();
    }
  }

  /**
   * Update vendor memory usage count and last used timestamp
   */
  async updateVendorMemoryUsage(vendorMemoryId: string): Promise<void> {
    return this.runInTransaction(async (client) => {
      await client.query(`
        UPDATE vendor_memory 
        SET usage_count = usage_count + 1, last_used = $1 
        WHERE id = $2
      `, [new Date(), vendorMemoryId]);

      await this.logAuditEntry(client, {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'update_vendor_usage',
        entityType: 'vendor_memory',
        entityId: vendorMemoryId,
        reasoning: 'Updated usage count and last used timestamp',
        timestamp: new Date()
      });
    });
  }

  // ==================== CORRECTION MEMORY OPERATIONS ====================

  /**
   * Store correction memory with audit logging
   */
  async storeCorrectionMemory(correctionMemory: CorrectionMemory): Promise<void> {
    return this.runInTransaction(async (client) => {
      await client.query(`
        INSERT INTO correction_memory (
          id, original_value, corrected_value, field_name, vendor_name,
          confidence_score, approval_count, rejection_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          original_value = EXCLUDED.original_value,
          corrected_value = EXCLUDED.corrected_value,
          field_name = EXCLUDED.field_name,
          vendor_name = EXCLUDED.vendor_name,
          confidence_score = EXCLUDED.confidence_score,
          approval_count = EXCLUDED.approval_count,
          rejection_count = EXCLUDED.rejection_count
      `, [
        correctionMemory.id,
        correctionMemory.originalValue,
        correctionMemory.correctedValue,
        correctionMemory.fieldName,
        correctionMemory.vendorName || null,
        correctionMemory.confidenceScore,
        correctionMemory.approvalCount,
        correctionMemory.rejectionCount,
        correctionMemory.createdAt
      ]);

      await this.logAuditEntry(client, {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'store_correction_memory',
        entityType: 'correction_memory',
        entityId: correctionMemory.id,
        afterState: correctionMemory,
        reasoning: `Stored correction memory for field ${correctionMemory.fieldName}`,
        confidenceScore: correctionMemory.confidenceScore,
        timestamp: new Date()
      });
    });
  }

  /**
   * Retrieve correction memory by field name and optional vendor
   */
  async getCorrectionMemory(fieldName: string, vendorName?: string): Promise<CorrectionMemory[]> {
    const client = await this.getClient();
    
    try {
      let query = `
        SELECT * FROM correction_memory 
        WHERE field_name = $1
      `;
      const params: any[] = [fieldName];
      
      if (vendorName) {
        query += ' AND (vendor_name = $2 OR vendor_name IS NULL)';
        params.push(vendorName);
      }
      
      query += ' ORDER BY confidence_score DESC, created_at DESC';

      const result = await client.query(query, params);

      const correctionMemories = result.rows.map(row => ({
        id: row.id,
        originalValue: row.original_value,
        correctedValue: row.corrected_value,
        fieldName: row.field_name,
        vendorName: row.vendor_name,
        confidenceScore: parseFloat(row.confidence_score),
        approvalCount: row.approval_count,
        rejectionCount: row.rejection_count,
        createdAt: new Date(row.created_at)
      }));

      await this.logMemoryAccess('correction_memory', `${fieldName}:${vendorName || 'any'}`, correctionMemories.length);
      
      return correctionMemories;
    } finally {
      client.release();
    }
  }

  /**
   * Update correction memory confidence based on feedback
   */
  async updateCorrectionMemoryFeedback(correctionId: string, approved: boolean): Promise<void> {
    return this.runInTransaction(async (client) => {
      // Get current state for audit
      const beforeResult = await client.query('SELECT * FROM correction_memory WHERE id = $1', [correctionId]);
      const beforeState = beforeResult.rows[0];
      
      if (approved) {
        await client.query(`
          UPDATE correction_memory 
          SET approval_count = approval_count + 1,
              confidence_score = LEAST(1.0, confidence_score + 0.1)
          WHERE id = $1
        `, [correctionId]);
      } else {
        await client.query(`
          UPDATE correction_memory 
          SET rejection_count = rejection_count + 1,
              confidence_score = GREATEST(0.0, confidence_score - 0.15)
          WHERE id = $1
        `, [correctionId]);
      }

      const afterResult = await client.query('SELECT * FROM correction_memory WHERE id = $1', [correctionId]);
      const afterState = afterResult.rows[0];

      await this.logAuditEntry(client, {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'update_correction_feedback',
        entityType: 'correction_memory',
        entityId: correctionId,
        beforeState,
        afterState,
        reasoning: `Updated correction memory based on ${approved ? 'positive' : 'negative'} feedback`,
        confidenceScore: parseFloat(afterState?.confidence_score || '0'),
        timestamp: new Date()
      });
    });
  }

  // ==================== RESOLUTION MEMORY OPERATIONS ====================

  /**
   * Store resolution memory with audit logging
   */
  async storeResolutionMemory(resolutionMemory: ResolutionMemory): Promise<void> {
    return this.runInTransaction(async (client) => {
      await client.query(`
        INSERT INTO resolution_memory (
          id, invoice_pattern, decision, confidence_score, 
          outcome_success, reasoning, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          invoice_pattern = EXCLUDED.invoice_pattern,
          decision = EXCLUDED.decision,
          confidence_score = EXCLUDED.confidence_score,
          outcome_success = EXCLUDED.outcome_success,
          reasoning = EXCLUDED.reasoning
      `, [
        resolutionMemory.id,
        resolutionMemory.invoicePattern,
        resolutionMemory.decision,
        resolutionMemory.confidenceScore,
        resolutionMemory.outcomeSuccess,
        resolutionMemory.reasoning,
        resolutionMemory.createdAt
      ]);

      await this.logAuditEntry(client, {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'store_resolution_memory',
        entityType: 'resolution_memory',
        entityId: resolutionMemory.id,
        afterState: resolutionMemory,
        reasoning: `Stored resolution memory for pattern: ${resolutionMemory.invoicePattern}`,
        confidenceScore: resolutionMemory.confidenceScore,
        timestamp: new Date()
      });
    });
  }

  /**
   * Retrieve resolution memory by invoice pattern
   */
  async getResolutionMemory(invoicePattern: string): Promise<ResolutionMemory[]> {
    const client = await this.getClient();
    
    try {
      const result = await client.query(`
        SELECT * FROM resolution_memory 
        WHERE invoice_pattern ILIKE $1 
        ORDER BY confidence_score DESC, created_at DESC
      `, [`%${invoicePattern}%`]);

      const resolutionMemories = result.rows.map(row => ({
        id: row.id,
        invoicePattern: row.invoice_pattern,
        decision: row.decision as 'auto-accept' | 'auto-correct' | 'human-review',
        confidenceScore: parseFloat(row.confidence_score),
        outcomeSuccess: row.outcome_success,
        reasoning: row.reasoning,
        createdAt: new Date(row.created_at)
      }));

      await this.logMemoryAccess('resolution_memory', invoicePattern, resolutionMemories.length);
      
      return resolutionMemories;
    } finally {
      client.release();
    }
  }

  // ==================== AUDIT LOG OPERATIONS ====================

  /**
   * Store audit log entry
   */
  private async logAuditEntry(client: PoolClient, auditLog: AuditLog): Promise<void> {
    await client.query(`
      INSERT INTO audit_logs (
        id, operation, entity_type, entity_id, before_state, 
        after_state, reasoning, confidence_score, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      auditLog.id,
      auditLog.operation,
      auditLog.entityType,
      auditLog.entityId,
      auditLog.beforeState ? JSON.stringify(auditLog.beforeState) : null,
      auditLog.afterState ? JSON.stringify(auditLog.afterState) : null,
      auditLog.reasoning,
      auditLog.confidenceScore || null,
      auditLog.timestamp
    ]);
  }

  /**
   * Log memory access for audit trail
   */
  private async logMemoryAccess(entityType: string, searchKey: string, resultCount: number): Promise<void> {
    try {
      const auditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        operation: 'memory_access',
        entityType,
        entityId: searchKey,
        reasoning: `Retrieved ${resultCount} ${entityType} records for key: ${searchKey}`,
        timestamp: new Date()
      };

      // Use a separate client for audit logging to avoid transaction conflicts
      if (this.pool) {
        const client = await this.pool.connect();
        try {
          await client.query(`
            INSERT INTO audit_logs (
              id, operation, entity_type, entity_id, before_state, 
              after_state, reasoning, confidence_score, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            auditLog.id,
            auditLog.operation,
            auditLog.entityType,
            auditLog.entityId,
            null,
            null,
            auditLog.reasoning,
            null,
            auditLog.timestamp
          ]);
        } finally {
          client.release();
        }
      }
    } catch (error) {
      // Log access errors but don't fail the main operation
      console.warn(`Failed to log memory access: ${error}`);
    }
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    operation?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    const client = await this.getClient();
    
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (filters.entityType) {
        query += ` AND entity_type = $${paramIndex}`;
        params.push(filters.entityType);
        paramIndex++;
      }
      
      if (filters.entityId) {
        query += ` AND entity_id = $${paramIndex}`;
        params.push(filters.entityId);
        paramIndex++;
      }
      
      if (filters.operation) {
        query += ` AND operation = $${paramIndex}`;
        params.push(filters.operation);
        paramIndex++;
      }
      
      if (filters.startDate) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters.endDate) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await client.query(query, params);

      const auditLogs = result.rows.map(row => ({
        id: row.id,
        operation: row.operation,
        entityType: row.entity_type,
        entityId: row.entity_id,
        beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
        afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
        reasoning: row.reasoning,
        confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : undefined,
        timestamp: new Date(row.timestamp)
      })) as AuditLog[];

      return auditLogs;
    } finally {
      client.release();
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    vendorMemoryCount: number;
    correctionMemoryCount: number;
    resolutionMemoryCount: number;
    auditLogCount: number;
  }> {
    const client = await this.getClient();
    
    try {
      const queries = [
        'SELECT COUNT(*) as count FROM vendor_memory',
        'SELECT COUNT(*) as count FROM correction_memory',
        'SELECT COUNT(*) as count FROM resolution_memory',
        'SELECT COUNT(*) as count FROM audit_logs'
      ];
      
      const results = await Promise.all(queries.map(query => client.query(query)));
      
      return {
        vendorMemoryCount: parseInt(results[0]?.rows?.[0]?.count || '0') || 0,
        correctionMemoryCount: parseInt(results[1]?.rows?.[0]?.count || '0') || 0,
        resolutionMemoryCount: parseInt(results[2]?.rows?.[0]?.count || '0') || 0,
        auditLogCount: parseInt(results[3]?.rows?.[0]?.count || '0') || 0
      };
    } finally {
      client.release();
    }
  }
}