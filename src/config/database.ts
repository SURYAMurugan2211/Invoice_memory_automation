/**
 * Database configuration for PostgreSQL
 */

import { Pool, PoolConfig, Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  min: number;
  max: number;
  idleTimeoutMillis: number;
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  const config: DatabaseConfig = {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'] || 'invoice_memory_automation',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
    ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
    min: parseInt(process.env['DB_POOL_MIN'] || '2'),
    max: parseInt(process.env['DB_POOL_MAX'] || '10'),
    idleTimeoutMillis: parseInt(process.env['DB_POOL_IDLE_TIMEOUT'] || '30000')
  };

  // Validate required configuration
  if (!config.password) {
    throw new Error('DB_PASSWORD environment variable is required');
  }

  return config;
}

/**
 * Create database if it doesn't exist
 */
export async function ensureDatabaseExists(): Promise<void> {
  const config = getDatabaseConfig();
  
  // Connect to postgres database first to create our target database
  const client = new Client({
    host: config.host,
    port: config.port,
    database: 'postgres', // Connect to default postgres database
    user: config.user,
    password: config.password,
    ssl: config.ssl
  });

  try {
    await client.connect();
    
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );
    
    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`Creating database: ${config.database}`);
      await client.query(`CREATE DATABASE "${config.database}"`);
      console.log(`✅ Database ${config.database} created successfully`);
    } else {
      console.log(`✅ Database ${config.database} already exists`);
    }
  } catch (error) {
    console.warn(`Warning: Could not create database automatically: ${error}`);
    console.log('Please create the database manually using pgAdmin or psql');
  } finally {
    await client.end();
  }
}

/**
 * Create PostgreSQL connection pool
 */
export function createDatabasePool(): Pool {
  const config = getDatabaseConfig();
  
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    min: config.min,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
    statement_timeout: 30000
  };

  return new Pool(poolConfig);
}