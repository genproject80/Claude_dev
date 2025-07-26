#!/usr/bin/env python3
"""
IoT Data Processor - ThingSpeak API Integration
Production-ready script for processing IoT device data from ThingSpeak API
and storing decoded data in SQL Server database tables.
"""

import os
import sys
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import requests
import pandas as pd
from tabulate import tabulate
from sqlalchemy import create_engine, text
import pyodbc


class IoTDataProcessor:
    """Main class for processing IoT data from ThingSpeak API."""
    
    def __init__(self, config_path: str = "config.json"):
        """Initialize the processor with configuration."""
        self.config = self._load_config(config_path)
        self.engine = None
        self.logger = self._setup_logging()
        self.session_stats = {
            'clients_processed': 0,
            'devices_processed': 0,
            'total_rows_inserted': 0,
            'api_calls_made': 0,
            'errors_encountered': 0,
            'start_time': time.time()
        }
        
        # Table column mappings based on P1 and P2 logic outputs
        self.table_mappings = {
            # P2 Logic Output -> IoT_Data_Sick table (operational data)
            'IoT_Data_Sick': {
                "entry_id": "Entry_ID",
                "Device_ID": "Device_ID",
                "GSM_Signal_Strength": "GSM_Signal_Strength",
                "Motor_ON_Time_sec": "Motor_ON_Time_sec",
                "Motor_OFF_Time_sec": "Motor_OFF_Time_sec",
                "Number_of_Wheels_Configured": "Number_of_Wheels_Configured",
                "Latitude": "Latitude",
                "Longitude": "Longitude",
                "Number_of_Wheels_Detected": "Number_of_Wheels_Detected",
                "Fault_Code": "Fault_Code",
                "Motor_Current_mA": "Motor_Current_mA",
                "CreatedAt": "CreatedAt",
                "HexField": "HexField",
                "Timestamp": "Timestamp"
            },
            # P1 Logic Output -> IoT_Data_New table (fault-related data)
            'IoT_Data_New': {
                "entry_id": "Entry_ID",
                "Device_ID": "Device_ID",
                "RuntimeMin": "RuntimeMin",
                "FaultCodes": "FaultCodes",
                "FaultDescriptions": "FaultDescriptions",
                "LeadingFaultCode": "LeadingFaultCode",
                "LeadingFaultTimeHr": "LeadingFaultTimeHr",
                "GensetSignal": "GensetSignal",
                "ThermostatStatus": "ThermostatStatus",
                "HVOutputVoltage_kV": "HVOutputVoltage_kV",
                "HVSourceNo": "HVSourceNo",
                "HVOutputCurrent_mA": "HVOutputCurrent_mA",
                "HexField": "HexField",
                "CreatedAt": "CreatedAt"
            }
        }
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            # Create default config if not exists
            default_config = {
                "database": {
                    "server": "localhost",
                    "database": "IoTDatabase",
                    "driver": "ODBC Driver 17 for SQL Server",
                    "trusted_connection": True
                },
                "client_id": 1,
                "thingspeak": {
                    "base_url": "https://api.thingspeak.com",
                    "timeout": 30,
                    "retry_attempts": 3,
                    "retry_delay": 2
                },
                "logging": {
                    "level": "INFO",
                    "log_folder": "logs"
                }
            }
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            return default_config
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration."""
        log_folder = self.config.get('logging', {}).get('log_folder', 'logs')
        os.makedirs(log_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = os.path.join(log_folder, f'iot_processor_{timestamp}.log')
        
        logging.basicConfig(
            level=getattr(logging, self.config.get('logging', {}).get('level', 'INFO')),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        logger = logging.getLogger(__name__)
        logger.info(f"IoT Data Processor started. Log file: {log_file}")
        return logger
    
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
                from urllib.parse import quote_plus
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
    
    def get_all_client_ids(self) -> List[int]:
        """Fetch all distinct client IDs from Device table."""
        query = "SELECT DISTINCT Client_ID FROM Device ORDER BY Client_ID"
        
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(text(query), conn)
            
            client_ids = df['Client_ID'].tolist()
            self.logger.info(f"Found {len(client_ids)} distinct client IDs: {client_ids}")
            return client_ids
            
        except Exception as e:
            self.logger.error(f"Failed to fetch client IDs: {str(e)}")
            raise
    
    def get_device_mappings(self, client_id: int) -> pd.DataFrame:
        """Fetch device mappings from Device table for a specific client."""
        query = """
        SELECT 
            Device_ID,
            Channel_ID,
            Field_ID,
            APIKey,
            ConversionLogicID,
            TransactionTableName,
            Client_ID
        FROM Device 
        WHERE Client_ID = :client_id
        """
        
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(
                    text(query), 
                    conn, 
                    params={'client_id': client_id}
                )
            
            self.logger.info(f"Retrieved {len(df)} device mappings for client_id: {client_id}")
            return df
            
        except Exception as e:
            self.logger.error(f"Failed to fetch device mappings for client {client_id}: {str(e)}")
            raise
    
    def get_last_created_at(self, device_id: str, table_name: str) -> Optional[datetime]:
        """Get the last CreatedAt timestamp for a device from target table."""
        query = f"""
        SELECT MAX(CreatedAt) as LastTime 
        FROM {table_name} 
        WHERE Device_ID = :device_id
        """
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(query), {'device_id': device_id}).fetchone()
                last_created = result[0] if result and result[0] else None
                
                if last_created:
                    return pd.to_datetime(last_created)
                return None
                
        except Exception as e:
            self.logger.warning(f"Could not get last CreatedAt for device {device_id}: {str(e)}")
            return None
    
    def fetch_thingspeak_data(self, channel_id: int, field_id: int, api_key: str, 
                            start_time: Optional[str] = None) -> List[Dict]:
        """Fetch data from ThingSpeak API with retry logic."""
        url = f"{self.config['thingspeak']['base_url']}/channels/{channel_id}/fields/{field_id}.json"
        
        params = {
            'api_key': api_key,
            'results': 8000  # ThingSpeak max
        }
        
        if start_time:
            params['start'] = start_time
        
        retry_attempts = self.config['thingspeak'].get('retry_attempts', 3)
        retry_delay = self.config['thingspeak'].get('retry_delay', 2)
        timeout = self.config['thingspeak'].get('timeout', 30)
        
        for attempt in range(retry_attempts):
            try:
                self.session_stats['api_calls_made'] += 1
                response = requests.get(url, params=params, timeout=timeout)
                response.raise_for_status()
                
                data = response.json()
                feeds = data.get('feeds', [])
                
                self.logger.info(f"Fetched {len(feeds)} records from ThingSpeak for channel {channel_id}, field {field_id}")
                return feeds
                
            except requests.exceptions.RequestException as e:
                self.logger.warning(f"API request attempt {attempt + 1} failed: {str(e)}")
                if attempt < retry_attempts - 1:
                    time.sleep(retry_delay)
                else:
                    self.logger.error(f"All retry attempts failed for channel {channel_id}, field {field_id}")
                    self.session_stats['errors_encountered'] += 1
                    return []
        
        return []
    
    # Helper functions for P1 and P2 logic processing
    def hex_to_binary(self, hex_value: str, length: int = 16) -> str:
        """Convert hex value to binary string with specified length."""
        return bin(int(hex_value, 16))[2:].zfill(length)
    
    def split_into_chunks(self, value: str, chunk_size: int = 8) -> List[str]:
        """Split a string into chunks of specified size."""
        return [value[i:i + chunk_size] for i in range(0, len(value), chunk_size)]
    
    def xor_hex_values(self, hex_value1: str, hex_value2: str) -> str:
        """XOR two hex strings and return result as hex string with proper padding."""
        int_val1 = int(hex_value1, 16)
        int_val2 = int(hex_value2, 16)
        xor_result = int_val1 ^ int_val2
        return f"{xor_result:08X}"
    
    def get_device_id_p2(self, first_chunk: str) -> str:
        """Extract Device_ID from first decrypted chunk."""
        series_hex = first_chunk[:4]
        serial_hex = first_chunk[4:]
        series_id = int(series_hex, 16)
        serial_no = int(serial_hex, 16)
        return f"{series_id}{serial_no}"
    
    def get_second_chunk_values(self, second_chunk: str) -> Dict[str, int]:
        """Extract GSM and Motor-related values from second decrypted chunk."""
        parts = [second_chunk[i:i + 2] for i in range(0, 8, 2)]
        values = [int(p, 16) for p in parts]
        return {
            "GSM_Signal_Strength": values[0],
            "Motor_ON_Time_sec": values[1],
            "Motor_OFF_Time_sec": values[2],
            "Number_of_Wheels_Configured": values[3]
        }
    
    def get_third_chunk_values(self, third_chunk: str) -> Dict[str, int]:
        """Extract Latitude and Longitude Integer values."""
        return {
            "Latitude_Integer": int(third_chunk[:4], 16),
            "Longitude_Integer": int(third_chunk[4:], 16)
        }
    
    def get_fractional_lat_lon(self, fourth_chunk: str, fifth_chunk: str) -> tuple:
        """Extract fractional parts of Latitude and Longitude."""
        return int(fourth_chunk, 16), int(fifth_chunk, 16)
    
    def get_sixth_chunk_values(self, sixth_chunk: str) -> Dict[str, int]:
        """Extract values from sixth decrypted chunk."""
        parts = [sixth_chunk[i:i + 2] for i in range(0, 8, 2)]
        num_wheels_detected = int(parts[0], 16)
        fault_code = int(parts[1], 16)
        # Swap bytes for motor current
        swapped_motor_current_hex = parts[3] + parts[2]
        motor_current_ma = int(swapped_motor_current_hex, 16)
        return {
            "Number_of_Wheels_Detected": num_wheels_detected,
            "Fault_Code": fault_code,
            "Motor_Current_mA": motor_current_ma
        }

    def decode_p1_logic(self, hex_val: str) -> Dict[str, Any]:
        """Decode P1 logic for fault-related data using TestingPIGreen implementation."""
        try:
            if not hex_val or pd.isna(hex_val):
                return {}
            
            # Check if hex_value contains only digits (P1 requirement)
            if not hex_val.isdigit():
                return {}
            
            # Format as 16-character hex string
            hex_str = format(int(hex_val), '016X')
            
            # Define fault codes mapping
            fault_codes = {
                0: "FAULT_HT_VTG_TOO_LOW", 1: "FAULT_HT_ARC_CNT_SHORT", 2: "FAULT_HT_I_TOO_LOW",
                3: "FAULT_THERMOSTAT_BROKEN", 4: "FAULT_GENSET_SIG_LOST", 5: "FAULT_MOTOR_CURRENT_TOO_LOW",
                6: "FAULT_MOTOR_CURRENT_TOO_HIGH", 7: "FAULT_SCRAPPING_PENDING",
                8: "FAULT_SOOT_COLLECTION_PENDING", 9: "FAULT_MOTOR_OUT_OF_PARK",
                10: "FAULT_GSM_SIG_LOST", 11: "FAULT_INDUCEMENT_REQUESTED",
                12: "FAULT_ES_SIGNAL", 13: "FAULT_SHAKER_MOTOR_CURRENT_TOO_LOW",
                14: "FAULT_SHAKER_MOTOR_CURRENT_TOO_HIGH", 15: "FAULT_INVALID_FAULT_REPORTED"
            }
            
            # Extract runtime from last 4 characters
            runtime = int(hex_str[-4:], 16)
            
            # Extract fault codes from positions -8 to -4
            fault_code_binary = self.hex_to_binary(hex_str[-8:-4], 16)
            fault_positions = [15 - i for i, bit in enumerate(fault_code_binary) if bit == '1']
            fault_descriptions = [fault_codes.get(pos, "No Fault") for pos in fault_positions]
            
            # Extract leading fault code and time
            leading_fault_code = int(hex_str[-10], 16)
            leading_fault_time = int(hex_str[-12:-10], 16)
            
            # Extract signal status
            signal_status_binary = self.hex_to_binary(hex_str[-14:-12], 8)
            genset_signal = "On" if signal_status_binary[0] == '1' else "Off"
            thermostat_status = "On" if signal_status_binary[1] == '1' else "Off"
            hv_output_voltage = int(signal_status_binary[2:], 2)
            
            # Extract HV output current
            hv_output_current_binary = self.hex_to_binary(hex_str[0:2], 8)
            hv_source_no = int(hv_output_current_binary[:2], 2)
            hv_output_current = int(hv_output_current_binary[-6:], 2)
            
            return {
                "RuntimeMin": runtime,
                "FaultCodes": ", ".join(map(str, fault_positions)),
                "FaultDescriptions": ", ".join(fault_descriptions),
                "LeadingFaultCode": leading_fault_code,
                "LeadingFaultTimeHr": leading_fault_time,
                "GensetSignal": genset_signal,
                "ThermostatStatus": thermostat_status,
                "HVOutputVoltage_kV": hv_output_voltage,
                "HVSourceNo": hv_source_no,
                "HVOutputCurrent_mA": hv_output_current
            }
            
        except Exception as e:
            self.logger.warning(f"Failed to decode P1 hex data '{hex_val}': {str(e)}")
            return {}
    
    def decode_p2_logic(self, hex_val: str) -> Dict[str, Any]:
        """Decode P2 logic for operational data using FinalSICKSensor implementation."""
        try:
            if not hex_val or pd.isna(hex_val):
                return {}
            
            # P2 uses long encrypted hex strings, not short numeric values
            if hex_val.isdigit() or len(hex_val) < 16:
                return {}
            
            # XOR decryption key
            key = "7AC5B2E1"
            
            # Split hex into 8-character chunks
            chunks = self.split_into_chunks(hex_val, 8)
            
            # Decrypt each chunk with XOR
            decrypted_chunks = [self.xor_hex_values(chunk, key) for chunk in chunks]
            
            # Ensure we have at least 6 chunks for complete processing
            if len(decrypted_chunks) < 6:
                self.logger.warning(f"P2 hex data too short, need at least 6 chunks: {hex_val}")
                return {}
            
            # Extract device ID from first chunk (optional, as we already have device_id)
            # device_id_extracted = self.get_device_id_p2(decrypted_chunks[0])
            
            # Extract values from different chunks
            second_chunk_values = self.get_second_chunk_values(decrypted_chunks[1])
            third_chunk_values = self.get_third_chunk_values(decrypted_chunks[2])
            lat_fraction, lon_fraction = self.get_fractional_lat_lon(decrypted_chunks[3], decrypted_chunks[4])
            sixth_chunk_values = self.get_sixth_chunk_values(decrypted_chunks[5])
            
            # Combine integer and fractional parts for coordinates
            full_latitude = float(f"{third_chunk_values['Latitude_Integer']}.{lat_fraction}")
            full_longitude = float(f"{third_chunk_values['Longitude_Integer']}.{lon_fraction}")
            
            # Return all P2 decoded values
            result = {
                "GSM_Signal_Strength": second_chunk_values["GSM_Signal_Strength"],
                "Motor_ON_Time_sec": second_chunk_values["Motor_ON_Time_sec"],
                "Motor_OFF_Time_sec": second_chunk_values["Motor_OFF_Time_sec"],
                "Number_of_Wheels_Configured": second_chunk_values["Number_of_Wheels_Configured"],
                "Latitude": full_latitude,
                "Longitude": full_longitude,
                "Number_of_Wheels_Detected": sixth_chunk_values["Number_of_Wheels_Detected"],
                "Fault_Code": sixth_chunk_values["Fault_Code"],
                "Motor_Current_mA": sixth_chunk_values["Motor_Current_mA"]
            }
            
            return result
            
        except Exception as e:
            self.logger.warning(f"Failed to decode P2 hex data '{hex_val}': {str(e)}")
            return {}
    
    def decode_data(self, hex_data: str, logic_id: int) -> Dict[str, Any]:
        """Decode hex data based on conversion logic ID."""
        if logic_id == 1:
            return self.decode_p1_logic(hex_data)
        elif logic_id == 2:
            return self.decode_p2_logic(hex_data)
        else:
            self.logger.warning(f"Unknown conversion logic ID: {logic_id}")
            return {}
    
    def insert_data_to_table(self, decoded_records: List[Dict], table_name: str, device_id: str) -> int:
        """Insert decoded data into the target table."""
        if not decoded_records:
            return 0
        
        try:
            # Create DataFrame with all records
            df = pd.DataFrame(decoded_records)
            
            # Get column mapping for the table
            column_mapping = self.table_mappings.get(table_name, {})
            if not column_mapping:
                self.logger.error(f"No column mapping found for table: {table_name}")
                return 0
            
            # Rename columns according to mapping
            df = df.rename(columns=column_mapping)
            
            # Convert datetime columns to proper format
            for col in ['CreatedAt', 'Timestamp']:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col]).dt.strftime('%Y-%m-%d %H:%M:%S')
            
            # Select only columns that exist in the mapping
            target_cols = [col for col in column_mapping.values() if col in df.columns]
            insert_df = df[target_cols]
            
            if insert_df.empty:
                self.logger.info(f"No valid data to insert for device {device_id}")
                return 0
            
            # Insert into database
            with self.engine.connect() as conn:
                rows_inserted = insert_df.to_sql(
                    table_name, 
                    conn, 
                    if_exists='append', 
                    index=False, 
                    method='multi'
                )
            
            self.logger.info(f"Inserted {rows_inserted} rows into {table_name} for device {device_id}")
            return rows_inserted
            
        except Exception as e:
            self.logger.error(f"Failed to insert data into {table_name} for device {device_id}: {str(e)}")
            self.session_stats['errors_encountered'] += 1
            return 0
    
    def process_device(self, device_row: pd.Series) -> int:
        """Process a single device using field-specific ThingSpeak API."""
        device_id = device_row['Device_ID']
        channel_id = device_row['Channel_ID']
        field_id = device_row['Field_ID']
        api_key = device_row['APIKey']
        logic_id = device_row['ConversionLogicID']
        table_name = device_row['TransactionTableName']
        
        self.logger.info(f"Processing device {device_id} (Channel: {channel_id}, Field: {field_id}, Logic: {logic_id})")
        
        # Get last timestamp for this device
        last_created_at = self.get_last_created_at(device_id, table_name)
        start_time = last_created_at.isoformat() if last_created_at else "2025-01-01T00:00:00Z"
        
        # Fetch field-specific data from ThingSpeak using existing method
        feeds = self.fetch_thingspeak_data(channel_id, field_id, api_key, start_time)
        
        if not feeds:
            self.logger.info(f"No new data for device {device_id}")
            return 0
        
        # Process and decode each feed from the specific field
        decoded_records = []
        field_key = f'field{field_id}'
        
        for feed in feeds:
            ts = pd.to_datetime(feed["created_at"])
            
            # Skip if timestamp is not newer than last created
            if last_created_at:
                import pytz
                last_created_utc = last_created_at.replace(tzinfo=pytz.UTC)
                if ts <= last_created_utc:
                    continue
            
            # Get hex value from the specific field
            hex_val = feed.get(field_key)
            if not hex_val:
                continue
                
            # Decode the data using device's conversion logic
            decoded_data = self.decode_data(hex_val, logic_id)
            
            if decoded_data:
                # Add required fields
                decoded_data.update({
                    "HexField": hex_val,
                    "entry_id": feed["entry_id"],
                    "Device_ID": device_id,
                    "CreatedAt": ts,
                    "Timestamp": ts
                })
                decoded_records.append(decoded_data)
        
        # Insert data for this device
        rows_inserted = self.insert_data_to_table(decoded_records, table_name, device_id)
        return rows_inserted
    
    def process_client(self, client_id: int) -> Dict[str, int]:
        """Process all devices for a single client individually using field-specific API."""
        client_stats = {
            'devices_processed': 0,
            'rows_inserted': 0,
            'api_calls': 0,
            'errors': 0
        }
        
        self.logger.info(f"Processing Client ID: {client_id}")
        
        try:
            # Get device mappings for this client
            devices_df = self.get_device_mappings(client_id)
            
            if devices_df.empty:
                self.logger.warning(f"No devices found for client {client_id}")
                return client_stats
            
            # Log client summary
            channels = devices_df['Channel_ID'].nunique()
            self.logger.info(f"Client {client_id}: {len(devices_df)} devices across {channels} channels")
            
            # Process each device individually using field-specific API
            for _, device_row in devices_df.iterrows():
                try:
                    rows_inserted = self.process_device(device_row)
                    client_stats['rows_inserted'] += rows_inserted
                    client_stats['devices_processed'] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error processing device {device_row['Device_ID']} for client {client_id}: {str(e)}")
                    client_stats['errors'] += 1
                    self.session_stats['errors_encountered'] += 1
                    continue
            
            self.logger.info(f"Client {client_id} completed: {client_stats['devices_processed']} devices, {client_stats['rows_inserted']} rows inserted")
            return client_stats
            
        except Exception as e:
            self.logger.error(f"Error processing client {client_id}: {str(e)}")
            client_stats['errors'] += 1
            self.session_stats['errors_encountered'] += 1
            return client_stats
    
    def run(self):
        """Main execution method - processes all clients."""
        try:
            self.logger.info("🚀 Starting IoT Data Processor execution for ALL CLIENTS")
            
            # Create database connection
            self._create_db_connection()
            
            # Get all client IDs
            client_ids = self.get_all_client_ids()
            
            if not client_ids:
                self.logger.warning("No clients found in database")
                return
            
            # Process each client
            for client_id in client_ids:
                try:
                    client_stats = self.process_client(client_id)
                    
                    # Update session statistics
                    self.session_stats['clients_processed'] += 1
                    self.session_stats['devices_processed'] += client_stats['devices_processed']
                    self.session_stats['total_rows_inserted'] += client_stats['rows_inserted']
                    
                except Exception as e:
                    self.logger.error(f"Critical error processing client {client_id}: {str(e)}")
                    self.session_stats['errors_encountered'] += 1
                    continue
            
            # Log final statistics
            self._log_session_summary()
            
        except Exception as e:
            self.logger.error(f"Critical error in main execution: {str(e)}")
            raise
    
    def _log_session_summary(self):
        """Log session summary statistics."""
        execution_time = time.time() - self.session_stats['start_time']
        
        summary_data = [
            ['Metric', 'Value'],
            ['Clients Processed', self.session_stats['clients_processed']],
            ['Devices Processed', self.session_stats['devices_processed']],
            ['Total Rows Inserted', self.session_stats['total_rows_inserted']],
            ['API Calls Made', self.session_stats['api_calls_made']],
            ['Errors Encountered', self.session_stats['errors_encountered']],
            ['Execution Time (seconds)', f"{execution_time:.2f}"],
            ['Execution Time (minutes)', f"{execution_time/60:.2f}"]
        ]
        
        summary_table = tabulate(summary_data, headers='firstrow', tablefmt='grid')
        
        self.logger.info("Session Summary:")
        self.logger.info(f"\n{summary_table}")


def main():
    """Main entry point."""
    try:
        processor = IoTDataProcessor()
        processor.run()
        
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Critical error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()