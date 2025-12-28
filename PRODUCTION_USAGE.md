# Production Usage Guide

This guide shows how to use the Invoice Memory Automation System in production environments.

## Quick Start

```typescript
import { InvoiceMemorySystem } from 'invoice-memory-automation';

// Initialize the system
const system = new InvoiceMemorySystem();
await system.initialize();

// Process an invoice
const invoice = {
  id: 'INV-12345',
  vendorName: 'Acme Corp',
  invoiceNumber: 'AC-2024-001',
  amount: 1250.00,
  date: new Date('2024-01-15'),
  lineItems: [],
  rawFields: {
    vendor_name: 'Acme Corp',
    invoice_num: 'AC-2024-001',
    total_amt: '$1,250.00'
  },
  processingMetadata: {
    receivedAt: new Date(),
    processingStarted: new Date(),
    confidenceScore: null,
    memorySourceIds: [],
    humanReviewRequired: false
  }
};

const result = await system.processInvoice(invoice);
console.log('Processing Result:', result);

// Learn from human corrections
if (result.decision === 'human-review') {
  const corrections = [
    {
      field: 'vendorName',
      originalValue: 'Acme Corp',
      correctedValue: 'ACME Corporation',
      confidence: 0.9,
      memorySourceId: 'correction_001',
      reasoning: 'Standardized vendor name'
    }
  ];
  
  await system.learnFromCorrections(invoice.id, corrections);
}

// Get system statistics
const stats = await system.getSystemStats();
console.log('System Stats:', stats);

// Close when done
await system.close();
```

## Environment Configuration

Create a `.env` file with your database credentials:

```env
# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=invoice_memory_automation
DB_USER=your-username
DB_PASSWORD=your-password
DB_SSL=true

# Connection Pool Settings
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Environment
NODE_ENV=production
```

## API Reference

### InvoiceMemorySystem

#### `initialize(): Promise<void>`
Initializes the database connection and creates necessary tables.

#### `processInvoice(invoice: Invoice): Promise<InvoiceProcessingResult>`
Processes an invoice through the complete memory-driven pipeline.

**Parameters:**
- `invoice`: Invoice object with required fields

**Returns:**
- `InvoiceProcessingResult`: Processing decision, confidence score, and audit trail

#### `learnFromCorrections(invoiceId: string, corrections: ProposedCorrection[]): Promise<void>`
Updates the system's memory based on human corrections.

**Parameters:**
- `invoiceId`: Unique identifier for the invoice
- `corrections`: Array of human corrections

#### `getSystemStats(): Promise<SystemStats>`
Returns current system statistics including memory counts and initialization status.

#### `close(): Promise<void>`
Closes database connections and cleans up resources.

## Processing Results

The system returns structured results with the following decision types:

### Auto-Accept (≥85% confidence)
```json
{
  "invoiceId": "INV-12345",
  "decision": "auto-accept",
  "confidenceScore": 0.92,
  "reasoning": "High confidence processing...",
  "appliedCorrections": [],
  "memoryInsights": {
    "vendorPatternsUsed": 3,
    "correctionsApplied": 0,
    "historicalAccuracy": 0.95
  }
}
```

### Auto-Correct (65-84% confidence)
```json
{
  "invoiceId": "INV-12345",
  "decision": "auto-correct",
  "confidenceScore": 0.78,
  "reasoning": "Medium confidence with corrections...",
  "appliedCorrections": [
    {
      "field": "vendorName",
      "originalValue": "Acme Corp",
      "correctedValue": "ACME Corporation",
      "confidence": 0.85
    }
  ]
}
```

### Human Review (<65% confidence)
```json
{
  "invoiceId": "INV-12345",
  "decision": "human-review",
  "confidenceScore": 0.45,
  "reasoning": "Low confidence requires human oversight...",
  "appliedCorrections": []
}
```

## Error Handling

```typescript
try {
  const result = await system.processInvoice(invoice);
  // Handle successful processing
} catch (error) {
  if (error.message.includes('not initialized')) {
    // System not initialized
    await system.initialize();
  } else if (error.message.includes('database')) {
    // Database connection issue
    console.error('Database error:', error);
  } else {
    // Other processing errors
    console.error('Processing error:', error);
  }
}
```

## Performance Considerations

### Connection Pooling
The system uses PostgreSQL connection pooling for optimal performance:
- Minimum connections: 5 (configurable)
- Maximum connections: 20 (configurable)
- Idle timeout: 30 seconds (configurable)

### Memory Usage
- Vendor patterns: Cached for fast retrieval
- Correction patterns: Indexed by field name and vendor
- Audit logs: Automatically managed with configurable retention

### Scaling
For high-volume processing:
1. Increase connection pool size
2. Use read replicas for memory retrieval
3. Implement horizontal scaling with multiple instances
4. Consider database partitioning for large audit logs

## Monitoring

### Health Checks
```typescript
const stats = await system.getSystemStats();
if (!stats.isInitialized) {
  // System not ready
  throw new Error('System not initialized');
}

// Check memory growth
if (stats.memoryStats.auditLogCount > 1000000) {
  // Consider log cleanup
  console.warn('Large audit log detected');
}
```

### Metrics to Monitor
- Processing throughput (invoices/minute)
- Confidence score distribution
- Memory pattern growth rate
- Database connection pool utilization
- Error rates by decision type

## Security

### Database Security
- Use SSL connections in production
- Implement proper user permissions
- Regular security updates
- Connection string encryption

### Data Privacy
- Audit logs contain processing metadata only
- Sensitive invoice data is not stored in memory patterns
- Implement data retention policies
- Consider GDPR compliance for EU operations

## Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoice-memory-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: invoice-memory-system
  template:
    metadata:
      labels:
        app: invoice-memory-system
    spec:
      containers:
      - name: app
        image: invoice-memory-system:latest
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check credentials in `.env`
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Low Confidence Scores**
   - System needs more training data
   - Provide human corrections
   - Check vendor pattern quality

3. **Memory Growth Issues**
   - Monitor audit log size
   - Implement log rotation
   - Consider archiving old patterns

4. **Performance Issues**
   - Increase connection pool size
   - Add database indexes
   - Monitor query performance

### Debug Mode
Set `NODE_ENV=development` for detailed logging:
```typescript
process.env.NODE_ENV = 'development';
const system = new InvoiceMemorySystem();
```

## Support

For production support:
1. Check system logs for error details
2. Monitor database performance metrics
3. Review audit trails for processing issues
4. Contact support with specific error messages and system statistics