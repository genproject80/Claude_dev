import pandas as pd

def split_into_chunks(value, chunk_size=8):
    """Split a string into chunks of specified size"""
    return [value[i:i + chunk_size] for i in range(0, len(value), chunk_size)]

def xor_hex_values(hex_value1, hex_value2):
    """XOR two hex strings and return result as hex string with proper padding"""
    int_val1 = int(hex_value1, 16)
    int_val2 = int(hex_value2, 16)
    xor_result = int_val1 ^ int_val2
    return f"{xor_result:08X}"

def get_device_id(first_chunk):
    """Extract Device_ID from first decrypted chunk"""
    series_hex = first_chunk[:4]
    serial_hex = first_chunk[4:]
    series_id = int(series_hex, 16)
    serial_no = int(serial_hex, 16)
    return f"{series_id}{serial_no}"

def get_second_chunk_values(second_chunk):
    """Extract GSM and Motor-related values from second decrypted chunk"""
    parts = [second_chunk[i:i + 2] for i in range(0, 8, 2)]
    values = [int(p, 16) for p in parts]
    return {
        "GSM Signal Strength": values[0],
        "Motor ON Time (sec)": values[1],
        "Motor OFF Time (sec)": values[2],
        "Number of Wheels Configured": values[3]
    }

def get_third_chunk_values(third_chunk):
    """Extract Latitude and Longitude Integer values"""
    return {
        "Latitude Integer": int(third_chunk[:4], 16),
        "Longitude Integer": int(third_chunk[4:], 16)
    }

def get_fractional_lat_lon(fourth_chunk, fifth_chunk):
    """Extract fractional parts of Latitude and Longitude"""
    return int(fourth_chunk, 16), int(fifth_chunk, 16)

def get_sixth_chunk_values(sixth_chunk):
    """Extract values from sixth decrypted chunk"""
    parts = [sixth_chunk[i:i + 2] for i in range(0, 8, 2)]
    num_wheels_detected = int(parts[0], 16)
    fault_code = int(parts[1], 16)
    swapped_motor_current_hex = parts[3] + parts[2]
    motor_current_ma = int(swapped_motor_current_hex, 16)
    return {
        "Number of Wheels Detected": num_wheels_detected,
        "Fault Code": fault_code,
        "Motor Current (mA)": motor_current_ma
    }

def process_iot_data(data):
    """Process IoT Data and return a clean DataFrame"""
    key = "7AC5B2E1"
    results = []

    for entry in data:
        timestamp, entry_id, hex_value = entry['created_at'], entry['entry_id'], entry['field10']

        chunks = split_into_chunks(hex_value, 8)
        decrypted_chunks = [xor_hex_values(chunk, key) for chunk in chunks]

        device_id = get_device_id(decrypted_chunks[0])
        second_chunk_values = get_second_chunk_values(decrypted_chunks[1])
        third_chunk_values = get_third_chunk_values(decrypted_chunks[2])
        lat_fraction_dec, lon_fraction_dec = get_fractional_lat_lon(decrypted_chunks[3], decrypted_chunks[4])
        full_latitude = float(f"{third_chunk_values['Latitude Integer']}.{lat_fraction_dec}")
        full_longitude = float(f"{third_chunk_values['Longitude Integer']}.{lon_fraction_dec}")
        sixth_chunk_values = get_sixth_chunk_values(decrypted_chunks[5])

        results.append({
            "Entry ID": entry_id,
            "Device_ID": device_id,
            "GSM Signal Strength": second_chunk_values["GSM Signal Strength"],
            "Motor ON Time (sec)": second_chunk_values["Motor ON Time (sec)"],
            "Motor OFF Time (sec)": second_chunk_values["Motor OFF Time (sec)"],
            "Number of Wheels Configured": second_chunk_values["Number of Wheels Configured"],
            "Latitude": full_latitude,
            "Longitude": full_longitude,
            "Number of Wheels Detected": sixth_chunk_values["Number of Wheels Detected"],
            "Fault Code": sixth_chunk_values["Fault Code"],
            "Motor Current (mA)": sixth_chunk_values["Motor Current (mA)"],
            "Timestamp": timestamp
        })

    return pd.DataFrame(results)

# Example Data
iot_data = [
    {"created_at": "2024-07-15T08:44:08+05:30", "entry_id": 1,
     "field10": "7ac5b2e07ecfb7e47dc5b2e17ac5b2e17ac5b2e17ac4d1e17ac5b29a7ac5b2e1"},
    {"created_at": "2025-07-21 10:38:06+05:30", "entry_id": 2,
     "field10": "328eb2e37acfb7eb7ac5b2e17ac5b2e17ac5b2e17ac5d1e17ac5b2c27ac5b2e1"},
    {"created_at": "2025-07-21 10:38:06+05:30", "entry_id": 2,
     "field10": "328eb2e2facfb3eb7ac5b2e17ac5b2e17ac5b2e16bc4e9e17ac5b2f57ac5b2e1"}
]

# Process Data
df = process_iot_data(iot_data)
print(df)
