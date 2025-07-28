import { MotorDevice, MotorFaultTileData } from "@/types/motorDevice";

export const mockMotorDevices: MotorDevice[] = [
  {
    entryId: 10,
    deviceId: "185071",
    gsmSign: 3,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 0,
    motorCurrent: 99,
    createdAt: "55:32.0"
  },
  {
    entryId: 11,
    deviceId: "185071",
    gsmSign: 128,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 1,
    motorCurrent: 98,
    createdAt: "58:55.0"
  },
  {
    entryId: 12,
    deviceId: "185071",
    gsmSign: 128,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 1,
    motorCurrent: 98,
    createdAt: "00:03.0"
  },
  {
    entryId: 13,
    deviceId: "185071",
    gsmSign: 128,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 1,
    motorCurrent: 98,
    createdAt: "01:06.0"
  },
  {
    entryId: 14,
    deviceId: "185071",
    gsmSign: 131,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 1,
    motorCurrent: 99,
    createdAt: "02:12.0"
  },
  {
    entryId: 15,
    deviceId: "185071",
    gsmSign: 131,
    motorOn: 10,
    motorOff: 10,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 1,
    motorCurrent: 99,
    createdAt: "03:17.0"
  },
  {
    entryId: 1,
    deviceId: "185072",
    gsmSign: 0,
    motorOn: 10,
    motorOff: 5,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 0,
    motorCurrent: 99,
    createdAt: "38:06.0"
  },
  {
    entryId: 2,
    deviceId: "185072",
    gsmSign: 0,
    motorOn: 10,
    motorOff: 5,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 0,
    motorCurrent: 99,
    createdAt: "40:17.0"
  },
  {
    entryId: 3,
    deviceId: "185072",
    gsmSign: 4,
    motorOn: 10,
    motorOff: 5,
    numberC: 10,
    latitude: 1792,
    longitude: 0,
    faultCode: 0,
    motorCurrent: 99,
    createdAt: "42:29.0"
  },
  {
    entryId: 4,
    deviceId: "185072",
    gsmSign: 4,
    motorOn: 10,
    motorOff: 5,
    numberC: 10,
    latitude: 1792,
    longitude: 0,
    faultCode: 0,
    motorCurrent: 99,
    createdAt: "43:34.0"
  },
  {
    entryId: 31,
    deviceId: "185073",
    gsmSign: 128,
    motorOn: 10,
    motorOff: 1,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 12,
    motorCurrent: 97,
    createdAt: "20:35.0"
  },
  {
    entryId: 32,
    deviceId: "185073",
    gsmSign: 0,
    motorOn: 10,
    motorOff: 1,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 4,
    motorCurrent: 98,
    createdAt: "21:41.0"
  },
  {
    entryId: 33,
    deviceId: "185073",
    gsmSign: 132,
    motorOn: 10,
    motorOff: 1,
    numberC: 10,
    latitude: 0,
    longitude: 0,
    faultCode: 12,
    motorCurrent: 99,
    createdAt: "22:51.0"
  }
];

export const motorFaultTiles: MotorFaultTileData[] = [
  {
    title: "Motor Faults",
    count: 6,
    severity: "high",
    description: "Motors with active fault codes"
  },
  {
    title: "Low GSM Signal",
    count: 4,
    severity: "medium",
    description: "Devices with weak connectivity"
  },
  {
    title: "GPS Tracking",
    count: 2,
    severity: "low",
    description: "Devices with location data"
  },
  {
    title: "Active Motors",
    count: 13,
    severity: "low",
    description: "Motors currently operational"
  }
];