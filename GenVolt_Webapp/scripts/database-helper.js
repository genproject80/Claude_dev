// Database Helper Script
// Executes SQL scripts using the backend database connection
// Usage: node database-helper.js script_name.sql

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: './backend/.env' });

class DatabaseHelper {
  constructor() {
    this.config = {
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
  }

  async connect() {
    try {
      console.log('🔗 Connecting to database...');
      console.log(`   Server: ${this.config.server}`);
      console.log(`   Database: ${this.config.database}`);
      console.log(`   User: ${this.config.user}`);
      
      this.pool = await sql.connect(this.config);
      console.log('✅ Database connection established');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async executeScript(scriptPath) {
    try {
      // Read the SQL script
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script file not found: ${scriptPath}`);
      }

      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      console.log(`📄 Executing script: ${path.basename(scriptPath)}`);
      console.log(`   Size: ${scriptContent.length} characters`);
      
      // Split the script into individual statements
      const statements = this.splitSQLStatements(scriptContent);
      console.log(`   Statements: ${statements.length}`);

      const results = [];
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        
        if (statement.length === 0) continue;
        
        // Handle PRINT statements
        if (statement.toUpperCase().startsWith('PRINT')) {
          const message = statement.match(/PRINT\s+'([^']+)'/i);
          if (message) {
            console.log(`💬 ${message[1]}`);
          } else {
            // Execute PRINT statement normally
            const request = this.pool.request();
            await request.query(statement);
          }
          continue;
        }

        // Skip GO statements
        if (statement.toUpperCase() === 'GO') continue;

        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          
          const request = this.pool.request();
          const result = await request.query(statement);
          
          // Handle different types of results
          if (result.recordset && result.recordset.length > 0) {
            console.log(`   📊 Returned ${result.recordset.length} rows`);
            
            // Show results in a readable format
            if (result.recordset.length <= 10) {
              console.table(result.recordset);
            } else {
              console.log(`   📋 First 5 rows:`);
              console.table(result.recordset.slice(0, 5));
              console.log(`   ... and ${result.recordset.length - 5} more rows`);
            }
          } else if (result.rowsAffected && result.rowsAffected[0] > 0) {
            console.log(`   ✏️  Affected ${result.rowsAffected[0]} rows`);
          } else {
            console.log(`   ✅ Statement executed successfully`);
          }

          results.push({
            statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
            success: true,
            rowsAffected: result.rowsAffected ? result.rowsAffected[0] : 0,
            recordCount: result.recordset ? result.recordset.length : 0
          });

        } catch (statementError) {
          console.error(`   ❌ Error in statement ${i + 1}:`, statementError.message);
          results.push({
            statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
            success: false,
            error: statementError.message
          });
          
          // Continue with other statements unless it's a critical error
          if (statementError.message.includes('Invalid object name') || 
              statementError.message.includes('Invalid column name')) {
            console.log(`   ⚠️  Continuing with remaining statements...`);
          } else {
            throw statementError;
          }
        }
      }

      return results;

    } catch (error) {
      console.error('❌ Script execution failed:', error.message);
      throw error;
    }
  }

  splitSQLStatements(script) {
    // Clean the script first
    script = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split on GO statements and semicolons, but handle quoted strings
    const statements = [];
    const lines = script.split('\n');
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (trimmedLine.length === 0 || trimmedLine.startsWith('--')) {
        continue;
      }
      
      if (trimmedLine.toUpperCase() === 'GO') {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      } else {
        currentStatement += line + '\n';
      }
    }
    
    // Add the last statement if there's no trailing GO
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => {
      const cleaned = stmt.trim();
      return cleaned.length > 0 && 
             !cleaned.startsWith('--') && 
             cleaned.toUpperCase() !== 'GO';
    });
  }

  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.close();
        console.log('📋 Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing connection:', error.message);
    }
  }

  async testConnection() {
    try {
      const request = this.pool.request();
      const result = await request.query('SELECT 1 as test');
      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🛠️  Database Helper Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node database-helper.js <script.sql>     - Execute SQL script');
    console.log('  node database-helper.js --test           - Test database connection');
    console.log('  node database-helper.js --info           - Show database info');
    console.log('');
    console.log('Available scripts:');
    const sqlFiles = fs.readdirSync('.').filter(f => f.endsWith('.sql'));
    sqlFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    return;
  }

  const helper = new DatabaseHelper();
  
  try {
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    if (args[0] === '--test') {
      await helper.testConnection();
    } else if (args[0] === '--info') {
      const request = helper.pool.request();
      const result = await request.query(`
        SELECT 
          DB_NAME() as database_name,
          USER_NAME() as current_user,
          @@VERSION as sql_version
      `);
      console.table(result.recordset);
    } else {
      const scriptPath = args[0];
      console.log('\\n🚀 Starting SQL script execution...\\n');
      
      const results = await helper.executeScript(scriptPath);
      
      console.log('\\n📊 Execution Summary:');
      console.log(`   Total statements: ${results.length}`);
      console.log(`   Successful: ${results.filter(r => r.success).length}`);
      console.log(`   Failed: ${results.filter(r => !r.success).length}`);
      
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('\\n❌ Failed statements:');
        failures.forEach((failure, index) => {
          console.log(`   ${index + 1}. ${failure.statement}`);
          console.log(`      Error: ${failure.error}`);
        });
      }
      
      console.log('\\n✅ Script execution completed!');
    }

  } catch (error) {
    console.error('\\n💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

// Export for use as module
module.exports = DatabaseHelper;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}