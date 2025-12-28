# PostgreSQL Database Setup

This guide will help you set up PostgreSQL for the Invoice Memory Automation System.

## Option 1: Local PostgreSQL Installation

### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Default port is 5432

### macOS
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Create a database
createdb invoice_memory_automation
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and create database
sudo -u postgres psql
CREATE DATABASE invoice_memory_automation;
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE invoice_memory_automation TO your_username;
\q
```

## Option 2: Docker PostgreSQL

```bash
# Run PostgreSQL in Docker
docker run --name postgres-invoice \
  -e POSTGRES_DB=invoice_memory_automation \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15

# Connect to verify
docker exec -it postgres-invoice psql -U postgres -d invoice_memory_automation
```

## Option 3: Cloud Database Services

### Supabase (Recommended for quick setup)
1. Go to https://supabase.com
2. Create a new project
3. Get your connection details from Settings > Database
4. Use the connection string in your .env file

### AWS RDS
1. Create a PostgreSQL RDS instance
2. Configure security groups to allow connections
3. Get the endpoint and credentials

### Google Cloud SQL
1. Create a PostgreSQL instance
2. Configure authorized networks
3. Get connection details

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update your `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_memory_automation
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_SSL=false
```

For cloud databases, you might need:
```env
DB_HOST=your-cloud-host.com
DB_PORT=5432
DB_NAME=invoice_memory_automation
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true
```

## Testing the Connection

Run the application to test the connection:
```bash
npm run build
npm start
```

If successful, you should see:
```
✅ Memory store initialized
```

## Troubleshooting

### Connection Issues
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check firewall settings
- Verify credentials in .env file

### Permission Issues
```sql
-- Connect as superuser and grant permissions
GRANT ALL PRIVILEGES ON DATABASE invoice_memory_automation TO your_username;
GRANT ALL ON SCHEMA public TO your_username;
```

### SSL Issues
For local development, set `DB_SSL=false`
For production, use proper SSL certificates and set `DB_SSL=true`