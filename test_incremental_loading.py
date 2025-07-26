#!/usr/bin/env python3
"""
IoT Testing Utility - Incremental Loading Test Script
Reusable script for testing incremental data loading by managing latest records per device.
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import pandas as pd
from tabulate import tabulate
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus


class IoTTestingUtility:
    """Utility class for testing incremental data loading."""
    
    def __init__(self, config_path: str = "config.json"):
        """Initialize the testing utility with configuration."""
        self.config = self._load_config(config_path)
        self.engine = None
        self.logger = self._setup_logging()
        
        # Table configurations
        self.tables = ['IoT_Data_Sick', 'IoT_Data_New']
        
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file '{config_path}' not found")
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[logging.StreamHandler(sys.stdout)]
        )
        return logging.getLogger(__name__)
    
    def _create_db_connection(self):
        """Create database connection using SQLAlchemy."""
        try:
            db_config = self.config['database']
            
            if db_config.get('trusted_connection', True):
                connection_string = (
                    f"mssql+pyodbc://@{db_config['server']}/{db_config['database']}"
                    f"?driver={db_config['driver']}&trusted_connection=yes"
                )
            else:
                # Azure SQL connection string
                params = quote_plus(
                    f"DRIVER={{{db_config['driver']}}};SERVER={db_config['server']};"
                    f"DATABASE={db_config['database']};UID={db_config['username']};"
                    f"PWD={db_config['password']};Encrypt=yes;TrustServerCertificate=no;"
                    f"Connection Timeout=30;"
                )
                connection_string = f"mssql+pyodbc:///?odbc_connect={params}"
            
            self.engine = create_engine(connection_string, echo=False)
            self.logger.info("Database connection established successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to create database connection: {str(e)}")
            raise
    
    def get_current_state(self) -> Dict[str, pd.DataFrame]:
        """Get current state of both IoT tables with MAX timestamps and counts."""
        results = {}
        
        for table in self.tables:
            query = f"""
            SELECT 
                Device_ID,
                COUNT(*) as RecordCount,
                MAX(CreatedAt) as MaxCreatedAt
            FROM {table}
            GROUP BY Device_ID
            ORDER BY Device_ID
            """
            
            try:
                with self.engine.connect() as conn:
                    df = pd.read_sql(text(query), conn)
                    results[table] = df
                    
            except Exception as e:
                self.logger.error(f"Failed to query {table}: {str(e)}")
                results[table] = pd.DataFrame()
        
        return results
    
    def display_current_state(self):
        """Display current state of both tables."""
        self.logger.info("🔍 Querying current state of IoT tables...")
        
        current_state = self.get_current_state()
        
        for table, df in current_state.items():
            if not df.empty:
                self.logger.info(f"\n📊 {table} - Current State:")
                print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
                self.logger.info(f"Total records in {table}: {df['RecordCount'].sum()}")
            else:
                self.logger.warning(f"No data found in {table}")
        
        return current_state
    
    def get_latest_records_info(self) -> Dict[str, List[Tuple]]:
        """Get information about latest records that would be deleted."""
        latest_info = {}
        
        for table in self.tables:
            # Query to get latest records per device
            query = f"""
            WITH LatestPerDevice AS (
                SELECT Device_ID, MAX(CreatedAt) as MaxCreatedAt
                FROM {table}
                GROUP BY Device_ID
            )
            SELECT 
                l.Device_ID,
                l.MaxCreatedAt,
                COUNT(*) as RecordsToDelete
            FROM LatestPerDevice l
            INNER JOIN {table} t ON l.Device_ID = t.Device_ID AND l.MaxCreatedAt = t.CreatedAt
            GROUP BY l.Device_ID, l.MaxCreatedAt
            ORDER BY l.Device_ID
            """
            
            try:
                with self.engine.connect() as conn:
                    df = pd.read_sql(text(query), conn)
                    latest_info[table] = [(row['Device_ID'], row['MaxCreatedAt'], row['RecordsToDelete']) 
                                        for _, row in df.iterrows()]
                    
            except Exception as e:
                self.logger.error(f"Failed to get latest records info for {table}: {str(e)}")
                latest_info[table] = []
        
        return latest_info
    
    def display_deletion_preview(self):
        """Display what would be deleted in dry-run mode."""
        self.logger.info("🔍 Preview of records that would be deleted...")
        
        latest_info = self.get_latest_records_info()
        total_to_delete = 0
        
        for table, records in latest_info.items():
            if records:
                self.logger.info(f"\n📋 {table} - Records to be deleted:")
                
                preview_data = []
                for device_id, max_created, count in records:
                    preview_data.append([device_id, max_created, count])
                    total_to_delete += count
                
                headers = ['Device_ID', 'Latest_CreatedAt', 'Records_To_Delete']
                print(tabulate(preview_data, headers=headers, tablefmt='grid'))
                
                table_total = sum(count for _, _, count in records)
                self.logger.info(f"Total records to delete from {table}: {table_total}")
            else:
                self.logger.warning(f"No records found to delete in {table}")
        
        self.logger.info(f"\n📊 Total records to delete across all tables: {total_to_delete}")
        return latest_info
    
    def delete_latest_records(self, confirm: bool = True) -> Dict[str, int]:
        """Delete latest records per device from both tables."""
        if confirm:
            # Show preview first
            latest_info = self.display_deletion_preview()
            
            # Ask for confirmation
            response = input("\n❓ Do you want to proceed with the deletion? (yes/no): ").lower().strip()
            if response not in ['yes', 'y']:
                self.logger.info("❌ Deletion cancelled by user")
                return {}
        
        self.logger.info("🗑️ Starting deletion of latest records...")
        deletion_results = {}
        
        for table in self.tables:
            # Delete latest records per device using CTE
            delete_query = f"""
            WITH LatestPerDevice AS (
                SELECT Device_ID, MAX(CreatedAt) as MaxCreatedAt
                FROM {table}
                GROUP BY Device_ID
            )
            DELETE t
            FROM {table} t
            INNER JOIN LatestPerDevice l ON t.Device_ID = l.Device_ID AND t.CreatedAt = l.MaxCreatedAt
            """
            
            try:
                with self.engine.connect() as conn:
                    result = conn.execute(text(delete_query))
                    rows_deleted = result.rowcount
                    conn.commit()
                    
                    deletion_results[table] = rows_deleted
                    self.logger.info(f"✅ Deleted {rows_deleted} latest records from {table}")
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to delete latest records from {table}: {str(e)}")
                deletion_results[table] = 0
        
        # Show summary
        total_deleted = sum(deletion_results.values())
        self.logger.info(f"\n📊 Deletion Summary:")
        for table, count in deletion_results.items():
            self.logger.info(f"  {table}: {count} records deleted")
        self.logger.info(f"  Total: {total_deleted} records deleted")
        
        return deletion_results
    
    def verify_deletion(self, before_state: Dict[str, pd.DataFrame]):
        """Verify deletion by comparing before and after states."""
        self.logger.info("🔍 Verifying deletion results...")
        
        after_state = self.get_current_state()
        
        for table in self.tables:
            if table in before_state and not before_state[table].empty:
                before_df = before_state[table]
                after_df = after_state.get(table, pd.DataFrame())
                
                self.logger.info(f"\n📊 {table} - Before vs After Deletion:")
                
                if not after_df.empty:
                    # Merge dataframes to compare
                    comparison = before_df.merge(
                        after_df, 
                        on='Device_ID', 
                        how='left', 
                        suffixes=('_Before', '_After')
                    )
                    
                    comparison['Records_Deleted'] = comparison['RecordCount_Before'] - comparison['RecordCount_After'].fillna(0)
                    
                    display_cols = ['Device_ID', 'RecordCount_Before', 'RecordCount_After', 'Records_Deleted', 'MaxCreatedAt_After']
                    print(tabulate(comparison[display_cols], headers='keys', tablefmt='grid', showindex=False))
                    
                    total_deleted = comparison['Records_Deleted'].sum()
                    self.logger.info(f"Total records deleted from {table}: {total_deleted}")
                else:
                    self.logger.warning(f"No data remaining in {table} after deletion")
    
    def run_query_mode(self):
        """Run in query mode - display current state."""
        self._create_db_connection()
        self.display_current_state()
    
    def run_delete_mode(self, confirm: bool = True):
        """Run in delete mode - delete latest records."""
        self._create_db_connection()
        
        # Get before state
        before_state = self.get_current_state()
        
        # Perform deletion
        deletion_results = self.delete_latest_records(confirm=confirm)
        
        if deletion_results:
            # Verify deletion
            self.verify_deletion(before_state)
            self.logger.info("✅ Deletion completed successfully")
        else:
            self.logger.info("❌ No deletions performed")
    
    def run_dry_run_mode(self):
        """Run in dry-run mode - show what would be deleted."""
        self._create_db_connection()
        self.display_deletion_preview()


def main():
    """Main entry point with command-line argument parsing."""
    parser = argparse.ArgumentParser(
        description="IoT Testing Utility for Incremental Loading Tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_incremental_loading.py --query          # Show current state
  python test_incremental_loading.py --dry-run        # Preview deletions
  python test_incremental_loading.py --delete         # Delete with confirmation
  python test_incremental_loading.py --delete --force # Delete without confirmation
        """
    )
    
    parser.add_argument('--query', action='store_true', 
                       help='Display current state of IoT tables')
    parser.add_argument('--delete', action='store_true',
                       help='Delete latest records per device')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be deleted without executing')
    parser.add_argument('--force', action='store_true',
                       help='Skip confirmation prompts (use with --delete)')
    parser.add_argument('--config', default='config.json',
                       help='Path to configuration file (default: config.json)')
    
    args = parser.parse_args()
    
    # Validate arguments
    if not any([args.query, args.delete, args.dry_run]):
        parser.print_help()
        sys.exit(1)
    
    if args.force and not args.delete:
        print("Error: --force can only be used with --delete")
        sys.exit(1)
    
    try:
        utility = IoTTestingUtility(args.config)
        
        if args.query:
            utility.run_query_mode()
        elif args.dry_run:
            utility.run_dry_run_mode()
        elif args.delete:
            utility.run_delete_mode(confirm=not args.force)
            
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Critical error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()