import { Device, FaultTileData, User } from "@/types/device";

// Mock device data based on your spreadsheet
export const mockDevices: Device[] = [
  {
    entryId: 1,
    runtimeMin: 2,
    faultCodes: "13",
    faultDescriptions: "FAULT_SHAKER_MOTOR_CURRENT_TOO_LOW",
    leadingFaultCode: 13,
    leadingFaultTimeHr: 0,
    gensetSignal: "Off",
    thermostatStatus: "On",
    hvOutputVoltage_kV: 0,
    hvSourceNo: 0,
    hvOutputCurrent_mA: 0,
    hexField: "18015292395504G6",
    createdAt: "2025-07-21 03:24:25.000 +00:00",
    deviceId: "P123"
  },
  {
    entryId: 2,
    runtimeMin: 1685,
    faultCodes: "5, 1, 0",
    faultDescriptions: "FAULT_MOTOR_CURRENT_TOO_LOW, FAULT_HT_ARC_CNT_SHO...",
    leadingFaultCode: 5,
    leadingFaultTimeHr: 28,
    gensetSignal: "On",
    thermostatStatus: "On",
    hvOutputVoltage_kV: 0,
    hvSourceNo: 0,
    hvOutputCurrent_mA: 0,
    hexField: "540743254370280S",
    createdAt: "2025-07-21 03:24:42.000 +00:00",
    deviceId: "R146"
  },
  {
    entryId: 3,
    runtimeMin: 9,
    faultCodes: "",
    faultDescriptions: "",
    leadingFaultCode: 0,
    leadingFaultTimeHr: 0,
    gensetSignal: "On",
    thermostatStatus: "Off",
    hvOutputVoltage_kV: 30,
    hvSourceNo: 2,
    hvOutputCurrent_mA: 3,
    hexField: "948401786528843273",
    createdAt: "2025-07-21 03:24:59.000 +00:00",
    deviceId: "Q123"
  },
  {
    entryId: 4,
    runtimeMin: 77,
    faultCodes: "5",
    faultDescriptions: "FAULT_MOTOR_CURRENT_TOO_LOW",
    leadingFaultCode: 5,
    leadingFaultTimeHr: 1,
    gensetSignal: "On",
    thermostatStatus: "Off",
    hvOutputVoltage_kV: 30,
    hvSourceNo: 0,
    hvOutputCurrent_mA: 15,
    hexField: "1125338400003131373",
    createdAt: "2025-07-21 03:25:15.000 +00:00",
    deviceId: "Q123"
  },
  {
    entryId: 5,
    runtimeMin: 2,
    faultCodes: "13",
    faultDescriptions: "FAULT_SHAKER_MOTOR_CURRENT_TOO_LOW",
    leadingFaultCode: 13,
    leadingFaultTimeHr: 0,
    gensetSignal: "Off",
    thermostatStatus: "On",
    hvOutputVoltage_kV: 0,
    hvSourceNo: 0,
    hvOutputCurrent_mA: 0,
    hexField: "18015292395504G6",
    createdAt: "2025-07-21 03:24:25.000 +00:00",
    deviceId: "P123"
  },
  {
    entryId: 6,
    runtimeMin: 1685,
    faultCodes: "5, 1, 0",
    faultDescriptions: "FAULT_MOTOR_CURRENT_TOO_LOW, FAULT_HT_ARC_CNT_SHO...",
    leadingFaultCode: 5,
    leadingFaultTimeHr: 28,
    gensetSignal: "On",
    thermostatStatus: "On",
    hvOutputVoltage_kV: 0,
    hvSourceNo: 0,
    hvOutputCurrent_mA: 0,
    hexField: "540743254370280S",
    createdAt: "2025-07-21 03:24:42.000 +00:00",
    deviceId: "R146"
  }
];

export const faultTiles: FaultTileData[] = [
  {
    title: "Critical Faults",
    count: 20,
    severity: "high",
    description: "Devices with critical system failures"
  },
  {
    title: "Motor Faults",
    count: 3,
    severity: "medium", 
    description: "Motor current issues detected"
  },
  {
    title: "Arc Faults",
    count: 1,
    severity: "medium",
    description: "High tension arc count issues"
  },
  {
    title: "Active Devices",
    count: 4,
    severity: "low",
    description: "Devices currently online"
  }
];

export const currentUser: User = {
  id: "1",
  name: "John Smith",
  email: "john.smith@company.com",
  role: "admin"
};