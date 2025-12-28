/**
 * Basic unit tests for MemoryStore to verify PostgreSQL functionality
 */

import { MemoryStore } from '../../src/models/MemoryStore';
import { VendorMemory } from '../../src/interfaces/Memory';

describe('MemoryStore Basic Tests', () => {
  let memoryStore: MemoryStore;

  beforeEach(async () => {
    // Set test environment variables
    process.env['DB_NAME'] = `test_basic_${Date.now()}`;
    process.env['DB_HOST'] = 'localhost';
    process.env['DB_USER'] = 'postgres';
    process.env['DB_PASSWORD'] = 'surya6262';
    
    memoryStore = new MemoryStore();
    await memoryStore.initialize();
  });

  afterEach(async () => {
    await memoryStore.close();
    // Note: In production, you might want to clean up test databases
  });

  test('should initialize database successfully', async () => {
    expect(memoryStore.isConnected()).toBe(true);
  });

  test('should store and retrieve vendor memory', async () => {
    const vendorMemory: VendorMemory = {
      id: 'test-vendor-1',
      vendorName: 'Test Vendor',
      fieldMappings: { 'invoice_number': 'invoiceNum' },
      normalizationRules: [{
        fieldName: 'amount',
        pattern: '\\$([0-9,]+\\.\\d{2})',
        replacement: '$1',
        confidenceScore: 0.9
      }],
      confidenceScore: 0.85,
      usageCount: 0,
      lastUsed: new Date(),
      createdAt: new Date()
    };

    await memoryStore.storeVendorMemory(vendorMemory);
    const retrieved = await memoryStore.getVendorMemory('Test Vendor');
    
    expect(retrieved.length).toBe(1);
    expect(retrieved[0]?.id).toBe('test-vendor-1');
    expect(retrieved[0]?.vendorName).toBe('Test Vendor');
    expect(retrieved[0]?.confidenceScore).toBeCloseTo(0.85, 2);
  });
});