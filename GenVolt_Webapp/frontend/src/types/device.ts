export interface Device {
  entryId: number;
  runtimeMin: number;
  faultCodes: string;
  faultDescriptions: string;
  leadingFaultCode: number;
  leadingFaultTimeHr: number;
  gensetSignal: "On" | "Off";
  thermostatStatus: "On" | "Off";
  hvOutputVoltage_kV: number;
  hvSourceNo: number;
  hvOutputCurrent_mA: number;
  hexField: string;
  createdAt: string;
  deviceId: string;
}

export interface FaultTileData {
  title: string;
  count: number;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}