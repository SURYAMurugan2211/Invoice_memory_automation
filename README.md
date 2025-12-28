# Invoice Memory Automation System

A production-ready memory-driven learning system for invoice automation using PostgreSQL, TypeScript and Node.js. This system uses heuristics and confidence-based memory to process invoices, learn from human corrections, and provide explainable reasoning for every decision.

## 🚀 Features

- **Memory-Driven Learning**: Uses heuristics and confidence scores instead of ML models
- **PostgreSQL Persistence**: Production-grade database with connection pooling and ACID compliance
- **Explainable AI**: Provides detailed reasoning for every decision with complete audit trails
- **Confidence Thresholds**: Configurable thresholds for auto-accept, auto-correct, and human review
- **Learning Evolution**: Demonstrates continuous improvement through human feedback
- **Production Ready**: Environment configuration, error handling, and scalable architecture

## 🏗️ Architecture

The system follows a layered architecture with clear separation of concerns:

- **InvoiceMemorySystem**: Main production class for invoice processing
- **Decision Engine**: Makes processing decisions based on confidence thresholds
- **Recall Engine**: Retrieves relevant memory patterns with confidence weighting
- **Apply Engine**: Normalizes invoice fields and proposes corrections
- **Learning Engine**: Updates memory based on human feedback
- **Memory Store**: PostgreSQL persistence layer with connection pooling

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn
- TypeScript

## 🛠️ Installation

### 1. Clone and Install Dependencies
```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Database Setup
```bash
# Option 1: Use existing PostgreSQL installation
# Create database manually or let the system create it automatically

# Option 2: Use Docker
docker run --name postgres-invoice \
  -e POSTGRES_DB=invoice_memory_automation \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_memory_automation
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false
```

### 4. Run the System
```bash
# Run the demo
npm start

# Or use the production class directly
npm run dev
```

## 🔧 Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Clean build artifacts
npm run clean
```

## 📁 Project Structure

```
src/
├── config/          # Database configuration
├── engines/         # Core processing engines
├── models/          # Data models and persistence
├── interfaces/      # TypeScript interfaces
├── demo/           # Demo runner (optional)
└── index.ts        # Main entry point with production class

tests/              # Test files
├── engines/        # Engine tests
├── models/         # Model tests
├── interfaces/     # Interface tests
└── setup.ts        # Jest configuration

dist/               # Compiled JavaScript output
coverage/           # Test coverage reports
```

## ⚙️ Configuration

### Confidence Thresholds
- **Auto-accept**: 0.85 (85% confidence)
- **Auto-correct**: 0.65 (65% confidence)  
- **Human review**: < 0.65 (below 65% confidence)

### Database Configuration
```env
DB_HOST=localhost           # Database host
DB_PORT=5432               # Database port
DB_NAME=invoice_memory_automation  # Database name
DB_USER=postgres           # Database user
DB_PASSWORD=your_password  # Database password
DB_SSL=false              # SSL mode (true for production)
DB_POOL_MIN=2             # Minimum connections
DB_POOL_MAX=10            # Maximum connections
```

## 🎯 Usage

### Production Usage
```typescript
import { InvoiceMemorySystem } from './src/index';

const system = new InvoiceMemorySystem();

// Initialize the system
await system.initialize();

// Process an invoice
const result = await system.processInvoice(invoice);

// Learn from corrections
await system.learnFromCorrections(invoiceId, corrections);

// Get system statistics
const stats = await system.getSystemStats();

// Close when done
await system.close();
```

### Demo Workflow
1. **Process Invoice #1** → Request human review (cold start)
2. **Apply Human Corrections** → Store patterns in memory
3. **Process Invoice #2** → Show improved decision-making with learned patterns
4. **Display Statistics** → Complete audit trail showing confidence evolution

## 🧪 Testing

The system includes essential basic tests for core functionality:

- **Basic Unit Tests**: Verify core database operations and engine functionality
- **Integration Tests**: Test PostgreSQL connectivity and basic workflows

```bash
# Run basic tests
npm test

# Run all tests (if any additional tests exist)
npm run test:all

# Run with coverage
npm run test:coverage
```

### Test Coverage
- ✅ Database connectivity and initialization
- ✅ Memory storage and retrieval operations  
- ✅ Engine instantiation and basic functionality
- ✅ PostgreSQL integration verification

## 📊 Performance

- **Connection Pooling**: Efficient PostgreSQL connection management
- **JSONB Storage**: Native JSON support for complex data structures
- **Optimized Indexing**: Strategic indexes for fast memory retrieval
- **Audit Trail**: Complete operation logging without performance impact

## 🔒 Security

- **Environment Variables**: Secure credential management
- **SQL Injection Protection**: Parameterized queries throughout
- **Connection Security**: SSL support for production deployments
- **Audit Compliance**: Complete operation tracking for regulatory requirements

## 🚀 Deployment

### Production Checklist
- [ ] Set up PostgreSQL with proper user permissions
- [ ] Configure environment variables securely
- [ ] Enable SSL for database connections
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Test with production data volumes

### Environment Variables for Production
```env
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=20
DB_POOL_MIN=5
```

## 📈 Monitoring

The system provides comprehensive statistics and audit trails:
- Memory pattern growth over time
- Confidence score evolution
- Processing decision distribution
- Complete audit trail for compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the DATABASE_SETUP.md for database configuration help
2. Review the test files for usage examples
3. Check the audit logs for debugging information