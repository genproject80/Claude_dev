import pytz

import pandas as pd
import requests
import pyodbc
from sqlalchemy import create_engine
from datetime import datetime
from tabulate import tabulate

# ------------------ Configuration ------------------ #
sql_conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=tcp:genvolt.database.windows.net,1433;"
    "DATABASE=gendb;"
    "UID=genadmin;"
    "PWD=genvolt@123;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)
engine = create_engine("mssql+pyodbc:///?odbc_connect=" + sql_conn_str)

client_id = 789# <-- change this value to switch clients
api_base = "https://api.thingspeak.com/channels/{channel_id}/fields/{field_id}.json?api_key={api_key}&start={start}"

iot_data_sick_map = {
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
}

iot_data_new_map = {
    "entry_id": "Entry_ID",
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
    "CreatedAt": "CreatedAt",
    "Device_ID": "Device_ID"
}

def get_last_created_at(device_id, table_name):
    query = f"SELECT MAX(CreatedAt) as LastTime FROM {table_name} WHERE Device_ID = '{device_id}'"
    df = pd.read_sql(query, engine)
    if df["LastTime"].iloc[0]:
        return pd.to_datetime(df["LastTime"].iloc[0])
    return None

def decode_hex_logic_p1(hex_val):
    if not hex_val or pd.isna(hex_val): return {}
    bin_str = bin(int(hex_val, 16))[2:].zfill(64)
    return {
        "RuntimeMin": int(bin_str[0:8], 2),
        "FaultCodes": ",".join([f"{i}" for i, bit in enumerate(bin_str[8:24]) if bit == '1']),
        "LeadingFaultCode": int(bin_str[24:32], 2),
        "LeadingFaultTimeHr": int(bin_str[32:40], 2),
        "GensetSignal": "On" if bin_str[40] == '1' else "Off",
        "ThermostatStatus": "On" if bin_str[41] == '1' else "Off",
        "HVOutputVoltage_kV": int(bin_str[42:48], 2),
        "HVSourceNo": int(bin_str[48:52], 2),
        "HVOutputCurrent_mA": int(bin_str[52:64], 2),
        "FaultDescriptions": None
    }

def decode_hex_logic_p2(hex_val):
    if not hex_val or pd.isna(hex_val): return {}
    bin_str = bin(int(hex_val, 16))[2:].zfill(64)
    return {
        "Latitude": float(int(bin_str[0:16], 2)) / 100,
        "Longitude": float(int(bin_str[16:32], 2)) / 100,
        "GSM_Signal_Strength": int(bin_str[32:40], 2),
        "Motor_ON_Time_sec": int(bin_str[40:48], 2),
        "Motor_OFF_Time_sec": int(bin_str[48:56], 2),
        "Number_of_Wheels_Configured": int(bin_str[56:60], 2),
        "Number_of_Wheels_Detected": int(bin_str[60:64], 2),
        "Fault_Code": int(bin_str[8:16], 2),
        "Motor_Current_mA": int(bin_str[56:64], 2)
    }

# def insert_into_sql(df):
#     if df.empty: return
#     table_name = df['TransactionTableName'].iloc[0]
#     if table_name == "IoT_Data_Sick":
#         col_map = iot_data_sick_map
#     elif table_name == "IoT_Data_New":
#         col_map = iot_data_new_map
#     else:
#         print(f"⚠️ Unsupported table: {table_name}")
#         return
#
#     df = df.rename(columns=col_map)
#     target_cols = list(col_map.values())
#     insert_df = df[[c for c in target_cols if c in df.columns]]
#     print(f"📝 Inserting {len(insert_df)} rows into {table_name}...")
#     insert_df.to_sql(table_name, con=engine, if_exists="append", index=False)
def insert_into_sql(df):
    if df.empty:
        return

    table_name = df['TransactionTableName'].iloc[0]

    if table_name == "IoT_Data_Sick":
        col_map = iot_data_sick_map
    elif table_name == "IoT_Data_New":
        col_map = iot_data_new_map
    else:
        print(f"⚠️ Unsupported table: {table_name}")
        return

    df = df.rename(columns=col_map)

    # Convert datetime columns to timezone-naive strings in correct SQL Server format
    for col in ['CreatedAt', 'Timestamp']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col]).dt.strftime('%Y-%m-%d %H:%M:%S')

    target_cols = list(col_map.values())
    insert_df = df[[c for c in target_cols if c in df.columns]]

    print(f"📝 Inserting {len(insert_df)} rows into {table_name}...")
    insert_df.to_sql(table_name, con=engine, if_exists="append", index=False)

def fetch_device_data(row):
    device_id = row["Device_ID"]
    channel_id = row["Channel_ID"]
    field_id = row["Field_ID"]
    api_key = row["APIKey"]
    logic = row["ConversionLogicID"]
    table = row["TransactionTableName"]

    last_created = get_last_created_at(device_id, table)
    start = last_created.isoformat() if last_created else "2025-01-01T00:00:00Z"
    url = api_base.format(channel_id=channel_id, field_id=field_id, api_key=api_key, start=start)

    print(f"🌐 Fetching: {url}")
    res = requests.get(url)
    feeds = res.json().get("feeds", [])
    rows = []
    for feed in feeds:
        ts = pd.to_datetime(feed["created_at"])
        if last_created:
            last_created = last_created.replace(tzinfo=pytz.UTC)
        if ts <= last_created:
            continue
        hex_val = feed.get(f"field{field_id}")
        if not hex_val:
            continue
        if logic == 1:
            decoded = decode_hex_logic_p1(hex_val)
        else:
            decoded = decode_hex_logic_p2(hex_val)

        decoded.update({
            "HexField": hex_val,
            "entry_id": feed["entry_id"],
            "Device_ID": device_id,
            "CreatedAt": ts,
            "Timestamp": ts,
            "TransactionTableName": table
        })
        rows.append(decoded)

    return pd.DataFrame(rows), table

def main():
    print("📥 Retrieving device mappings...")
    device_df = pd.read_sql(f"SELECT * FROM Device WHERE Client_ID = {client_id}", engine)
    all_data = []

    for _, row in device_df.iterrows():
        df, _ = fetch_device_data(row)
        if not df.empty:
            print(tabulate(df.head(5), headers='keys', tablefmt='grid'))
            all_data.append(df)

    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
        insert_into_sql(final_df)
    else:
        print("🚫 No new data found.")

if __name__ == "__main__":
    main()
