// TypeScript interfaces for Motor IoT devices from IoT_Data_Sick table

export interface MotorDevice {
  entryId: number;
  deviceId: string;
  gsmSignalStrength: number;
  motorOnTimeSec: number;
  motorOffTimeSec: number;
  wheelsConfigured: number;
  latitude: number;
  longitude: number;
  wheelsDetected: number;
  faultCode: number;
  motorCurrentMA: number;
  createdAt: string;
  hexField: string;
  timestamp: string;
}

export interface MotorFaultTileData {
  title: string;
  count: number;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface MotorStats {
  total_readings: number;
  avg_motor_current: number;
  min_motor_current: number;
  max_motor_current: number;
  avg_on_time: number;
  avg_off_time: number;
  avg_wheels_detected: number;
  fault_count: number;
}

export interface MotorDashboardOverview {
  motors: {
    total_motors: number;
    motors_with_faults: number;
    avg_motor_current: number;
    avg_wheels_detected: number;
  };
  faults: {
    fault_code_1: number;
    fault_code_2: number;
    other_faults: number;
  };
}