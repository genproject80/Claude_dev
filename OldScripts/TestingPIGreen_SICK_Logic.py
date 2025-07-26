import pandas as pd
import pyodbc
import requests
from sqlalchemy import create_engine
import urllib

# ----------------------------------------
# Helpers
# ----------------------------------------
def hex_to_binary(hex_value, length=16):
    return bin(int(hex_value, 16))[2:].zfill(length)


def split_into_chunks(value, chunk_size=8):
    return [value[i:i + chunk_size] for i in range(0, len(value), chunk_size)]


def xor_hex_values(hex_value1, hex_value2):
    int_val1 = int(hex_value1, 16)
    int_val2 = int(hex_value2, 16)
    xor_result = int_val1 ^ int_val2
    return f"{xor_result:08X}"


def get_device_id_p2(first_chunk):
    series_hex, serial_hex = first_chunk[:4], first_chunk[4:]
    return f"{int(series_hex, 16)}{int(serial_hex, 16)}"


def get_second_chunk_values(second_chunk):
    parts = [second_chunk[i:i + 2] for i in range(0, 8, 2)]
    return {
        "GSM Signal Strength": int(parts[0], 16),
        "Motor ON Time (sec)": int(parts[1], 16),
        "Motor OFF Time (sec)": int(parts[2], 16),
        "Number of Wheels Configured": int(parts[3], 16)
    }


def get_third_chunk_values(third_chunk):
    return {
        "Latitude Integer": int(third_chunk[:4], 16),
        "Longitude Integer": int(third_chunk[4:], 16)
    }


def get_fractional_lat_lon(fourth_chunk, fifth_chunk):
    return int(fourth_chunk, 16), int(fifth_chunk, 16)


def get_sixth_chunk_values(sixth_chunk):
    parts = [sixth_chunk[i:i + 2] for i in range(0, 8, 2)]
    swapped_motor_current_hex = parts[3] + parts[2]
    return {
        "Number of Wheels Detected": int(parts[0], 16),
        "Fault Code": int(parts[1], 16),
        "Motor Current (mA)": int(swapped_motor_current_hex, 16)
    }

# ----------------------------------------
# Logic P1 (Untouched)
# ----------------------------------------
def process_logic_p1(api_data, channel_id, device_lookup):
    print(f"🔧 Processing data with Logic P1 for Channel {channel_id}...")
    feeds = api_data.get('feeds', [])
    processed_rows = []

    fault_codes = {
        0: "FAULT_HT_VTG_TOO_LOW", 1: "FAULT_HT_ARC_CNT_SHORT", 2: "FAULT_HT_I_TOO_LOW",
        3: "FAULT_THERMOSTAT_BROKEN", 4: "FAULT_GENSET_SIG_LOST", 5: "FAULT_MOTOR_CURRENT_TOO_LOW",
        6: "FAULT_MOTOR_CURRENT_TOO_HIGH", 7: "FAULT_SCRAPPING_PENDING",
        8: "FAULT_SOOT_COLLECTION_PENDING", 9: "FAULT_MOTOR_OUT_OF_PARK",
        10: "FAULT_GSM_SIG_LOST", 11: "FAULT_INDUCEMENT_REQUESTED",
        12: "FAULT_ES_SIGNAL", 13: "FAULT_SHAKER_MOTOR_CURRENT_TOO_LOW",
        14: "FAULT_SHAKER_MOTOR_CURRENT_TOO_HIGH", 15: "FAULT_INVALID_FAULT_REPORTED"
    }

    for feed in feeds:
        for i in range(1, 9):
            field_key = f'field{i}'
            hex_value = feed.get(field_key)

            if hex_value and hex_value.isdigit():
                device_info = device_lookup.get((str(channel_id), field_key))
                if not device_info:
                    print(f"⚠️ No Device mapping found for Channel {channel_id}, Field {field_key}")
                    continue

                device_id = device_info['Device_ID']
                target_table = device_info['TransactionTableName']
                print(f"📌 Found Device_ID={device_id}, Target Table={target_table} for Field={field_key}")

                hex_str = format(int(hex_value), '016X')
                runtime = int(hex_str[-4:], 16)
                fault_code_binary = hex_to_binary(hex_str[-8:-4], 16)
                fault_positions = [15 - i for i, bit in enumerate(fault_code_binary) if bit == '1']
                fault_descriptions = [fault_codes.get(pos, "No Fault") for pos in fault_positions]

                leading_fault_code = int(hex_str[-10], 16)
                leading_fault_time = int(hex_str[-12:-10], 16)
                signal_status_binary = hex_to_binary(hex_str[-14:-12], 8)
                genset_signal = "On" if signal_status_binary[0] == '1' else "Off"
                thermostat_status = "On" if signal_status_binary[1] == '1' else "Off"
                hv_output_voltage = int(signal_status_binary[2:], 2)
                hv_output_current_binary = hex_to_binary(hex_str[0:2], 8)
                hv_source_no = int(hv_output_current_binary[:2], 2)
                hv_output_current = int(hv_output_current_binary[-6:], 2)

                processed_rows.append({
                    "Device_id": device_id,
                    "CreatedAt": feed['created_at'],
                    "EntryID": feed['entry_id'],
                    "HexField": hex_value,
                    "RuntimeMin": runtime,
                    "FaultCodes": ", ".join(map(str, fault_positions)),
                    "FaultDescriptions": ", ".join(fault_descriptions),
                    "LeadingFaultCode": leading_fault_code,
                    "LeadingFaultTimeHr": leading_fault_time,
                    "GensetSignal": genset_signal,
                    "ThermostatStatus": thermostat_status,
                    "HVOutputVoltage_kV": hv_output_voltage,
                    "HVSourceNo": hv_source_no,
                    "HVOutputCurrent_mA": hv_output_current,
                    "TargetTable": target_table
                })
    print(f"✅ Completed processing {len(processed_rows)} rows for P1.")
    return pd.DataFrame(processed_rows)


# ----------------------------------------
# Updated Logic P2 (Field1-8 Scan + Column Mapping)
# ----------------------------------------
def process_logic_p2(api_data, channel_id, device_lookup):
    print(f"🔧 Processing data with Logic P2 for Channel {channel_id}...")
    feeds = api_data.get('feeds', [])
    key = "7AC5B2E1"
    processed_rows = []

    for feed in feeds:
        found_hex = False

        for i in range(1, 9):  # Scan field1 to field8
            field_key = f'field{i}'
            hex_value = feed.get(field_key)

            if hex_value:
                found_hex = True

                device_info = device_lookup.get((str(channel_id), field_key))
                if not device_info:
                    print(f"⚠️ No Device mapping found for Channel {channel_id}, Field {field_key}")
                    continue

                device_id = device_info['Device_ID']
                target_table = device_info['TransactionTableName']
                print(f"📌 Found Device_ID={device_id}, Target Table={target_table} for Field={field_key}")

                chunks = split_into_chunks(hex_value, 8)
                decrypted_chunks = [xor_hex_values(chunk, key) for chunk in chunks]

                second_chunk_values = get_second_chunk_values(decrypted_chunks[1])
                third_chunk_values = get_third_chunk_values(decrypted_chunks[2])
                lat_frac, lon_frac = get_fractional_lat_lon(decrypted_chunks[3], decrypted_chunks[4])
                full_latitude = float(f"{third_chunk_values['Latitude Integer']}.{lat_frac}")
                full_longitude = float(f"{third_chunk_values['Longitude Integer']}.{lon_frac}")
                sixth_chunk_values = get_sixth_chunk_values(decrypted_chunks[5])

                processed_rows.append({
                    "Device_id": device_id,
                    "CreatedAt": feed['created_at'],
                    "EntryID": feed['entry_id'],
                    "GSM Signal Strength": second_chunk_values["GSM Signal Strength"],
                    "Motor ON Time (sec)": second_chunk_values["Motor ON Time (sec)"],
                    "Motor OFF Time (sec)": second_chunk_values["Motor OFF Time (sec)"],
                    "Number of Wheels Configured": second_chunk_values["Number of Wheels Configured"],
                    "Latitude": full_latitude,
                    "Longitude": full_longitude,
                    "Number of Wheels Detected": sixth_chunk_values["Number of Wheels Detected"],
                    "Fault Code": sixth_chunk_values["Fault Code"],
                    "Motor Current (mA)": sixth_chunk_values["Motor Current (mA)"],
                    "TargetTable": target_table
                })

        if not found_hex:
            print(f"⚠️ No hex value found in fields 1-8 for Entry {feed.get('entry_id')}")

    print(f"✅ Completed processing {len(processed_rows)} rows for P2.")
    return pd.DataFrame(processed_rows)


# ----------------------------------------
# Other Helpers
# ----------------------------------------
def determine_conversion_logic(conversion_logic_id):
    return process_logic_p2 if conversion_logic_id == 2 else process_logic_p1


def fetch_channel_data(api_url):
    print(f"🌐 Fetching data from API: {api_url}")
    response = requests.get(api_url)
    if response.status_code == 200:
        print("✅ API data fetched successfully.")
        return response.json()
    else:
        raise Exception(f"❌ API call failed: {response.status_code} {response.text}")


def insert_dataframe_to_sql(df, connection_string):
    params = urllib.parse.quote_plus(connection_string)
    engine = create_engine(f"mssql+pyodbc:///?odbc_connect={params}")

    # Column mappings for Logic P2 tables
    p2_column_mapping = {
        "Device_id": "device_id",
        "CreatedAt": "created_at",
        "EntryID": "entry_id",
        "GSM Signal Strength": "gsm_signal_strength",
        "Motor ON Time (sec)": "motor_on_time_sec",
        "Motor OFF Time (sec)": "motor_off_time_sec",
        "Number of Wheels Configured": "num_wheels_configured",
        "Latitude": "latitude",
        "Longitude": "longitude",
        "Number of Wheels Detected": "num_wheels_detected",
        "Fault Code": "fault_code",
        "Motor Current (mA)": "motor_current_ma"
    }

    for table_name, group_df in df.groupby('TargetTable'):
        group_df = group_df.drop(columns=["TargetTable"], errors='ignore')

        if "GSM Signal Strength" in group_df.columns:
            print(f"🔄 Mapping columns for P2 data to match table {table_name}")
            group_df.rename(columns=p2_column_mapping, inplace=True)

        print(f"📝 Inserting {len(group_df)} rows into table: {table_name}")
        group_df.to_sql(table_name, con=engine, if_exists='append', index=False)
        print(f"✅ Successfully inserted into {table_name}")


def pull_device_list_and_lookup(connection_string):
    print("📥 Pulling device mappings from database...")
    conn = pyodbc.connect(connection_string)
    query = """
        SELECT channel_id, APIKey, ConversionLogicID, Field_ID, Device_ID, TransactionTableName
        FROM device
    """
    df = pd.read_sql(query, conn)
    conn.close()
    device_lookup = {
        (str(row['channel_id']), f"field{row['Field_ID']}"): {
            'Device_ID': row['Device_ID'],
            'TransactionTableName': row['TransactionTableName']
        }
        for _, row in df.iterrows()
    }
    print(f"✅ Retrieved {len(device_lookup)} device mappings.")
    return df, device_lookup


# ----------------------------------------
# Main flow
# ----------------------------------------
if __name__ == "__main__":
    db_connection_string = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=tcp:genvolt.database.windows.net,1433;"
        "DATABASE=gendb;"
        "UID=genadmin;"
        "PWD=genvolt@123;"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )

    device_df, device_lookup = pull_device_list_and_lookup(db_connection_string)

    if not device_df.empty:
        for _, row in device_df.drop_duplicates(subset=['channel_id']).iterrows():
            channel_id = row['channel_id']
            api_key = row['APIKey']
            conversion_logic_id = row['ConversionLogicID']
            print(f"\n🔁 Processing Channel {channel_id} with Conversion Logic {conversion_logic_id}...")
            api_url = f"https://api.thingspeak.com/channels/{channel_id}/feeds.json?api_key={api_key}"

            try:
                api_data = fetch_channel_data(api_url)
                logic_function = determine_conversion_logic(conversion_logic_id)
                processed_df = logic_function(api_data, channel_id, device_lookup)

                if not processed_df.empty:
                    print(f"📦 Processed DataFrame:\n{processed_df.head()}")
                    insert_dataframe_to_sql(processed_df, db_connection_string)
                else:
                    print(f"⚠️ No processed data for Channel {channel_id}")

            except Exception as e:
                print(f"❌ Error processing Channel {channel_id}: {e}")
