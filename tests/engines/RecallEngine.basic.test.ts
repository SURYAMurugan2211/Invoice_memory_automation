/**
 * Basic tests for RecallEngine to verify PostgreSQL functionality
 */

import { RecallEngine } from '../../src/engines/RecallEngine';
import { MemoryStore } from '../../src/models/MemoryStore';
import { VendorMemory } from '../../src/interfaces/Memory';

describe('RecallEngine Basic Tests', () => {
  let recallEngine: RecallEngine;
  let memoryStore: MemoryStore;

  beforeEach(async () => {
    // Set test environment variables
    process.env['DB_NAME'] = `test_recall_basic_${Date.now()}`;
    process.env['DB_HOST'] = 'localhost';
    process.env['DB_USER'] = 'postgres';
    process.env['DB_PASSWORD'] = 'surya6262';
    
    memoryStore = new MemoryStore();
    await memoryStore.initialize();
    recallEngine = new RecallEngine(memoryStore);
  });

  afterEach(async () => {
    await memoryStore.close();
    // Note: In production, you might want to clean up test databases
  });

  test('should create RecallEngine instance', () => {
    expect(recallEngine).toBeDefined();
  });

  test('should retrieve vendor memory in confidence order', async () => {
    const vendorMemory1: VendorMemory = {
      id: 'vm1',
      vendorName: 'Test Vendor',
      fieldMappings: { 'invoice_number': 'invoiceNum' },
      normalizationRules: [],
      confidenceScore: 0.7,
      usageCount: 5,
      lastUsed: new Date(),
      createdAt: new Date()
    };

    const vendorMemory2: VendorMemory = {
      id: 'vm2',
      vendorName: 'Test Vendor',
      fieldMappings: { 'amount': 'totalAmount' },
      normalizationRules: [],
      confidenceScore: 0.9,
      usageCount: 2,
      lastUsed: new Date(),
      createdAt: new Date()
    };

    // Store memories
    await memoryStore.storeVendorMemory(vendorMemory1);
    await memoryStore.storeVendorMemory(vendorMemory2);

    // Retrieve using RecallEngine
    const retrieved = await recallEngine.getVendorMemory('Test Vendor');

    expect(retrieved.length).toBe(2);
    // Should be ordered by confidence (0.9 first, then 0.7)
    expect(retrieved[0]?.confidenceScore).toBe(0.9);
    expect(retrieved[1]?.confidenceScore).toBe(0.7);
  });
});