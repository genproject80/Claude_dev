import { useState, useEffect } from "react";
import { FaultTiles } from "@/components/dashboard/FaultTiles";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { deviceApi, dashboardApi } from "@/services/api";
import { Device, FaultTileData } from "@/types/device";

const Index = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [faultTiles, setFaultTiles] = useState<FaultTileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch devices and dashboard overview in parallel
        const [devicesResponse, overviewResponse] = await Promise.all([
          deviceApi.getAll(),
          dashboardApi.getOverview()
        ]);

        if (devicesResponse.success) {
          // Transform API data to match frontend Device interface
          const transformedDevices: Device[] = devicesResponse.data.map((apiDevice: any, index: number) => ({
            entryId: apiDevice.latestData?.entryId || (1000000 + index), // Generate unique fallback IDs
            runtimeMin: apiDevice.latestData?.runtimeMin || 0,
            faultCodes: apiDevice.latestData?.faultCodes || "",
            faultDescriptions: "", // Will need to be derived from fault codes
            leadingFaultCode: 0, // Will need to be calculated
            leadingFaultTimeHr: 0, // Will need to be calculated
            gensetSignal: "Unknown", // Not in current API
            thermostatStatus: "Unknown", // Not in current API
            hvOutputVoltage_kV: 0, // Not in current API
            hvSourceNo: 0, // Not in current API
            hvOutputCurrent_mA: 0, // Not in current API
            hexField: "", // Not in current API
            createdAt: apiDevice.latestData?.timestamp || new Date().toISOString(),
            deviceId: apiDevice.id
          }));
          setDevices(transformedDevices);
        }

        if (overviewResponse.success) {
          // Transform overview data to fault tiles
          const overview = overviewResponse.data;
          const tiles: FaultTileData[] = [
            {
              title: "Critical Alerts",
              count: overview.alerts?.critical_alerts || 0,
              severity: "high",
              description: "Devices with critical system failures"
            },
            {
              title: "Warning Alerts", 
              count: overview.alerts?.warning_alerts || 0,
              severity: "medium",
              description: "Devices with warning conditions"
            },
            {
              title: "Info Alerts",
              count: overview.alerts?.info_alerts || 0,
              severity: "low", 
              description: "Informational alerts"
            },
            {
              title: "Online Devices",
              count: overview.devices?.online_devices || 0,
              severity: "low",
              description: "Devices currently online"
            }
          ];
          setFaultTiles(tiles);
        }

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Dashboard</h2>
            <p className="text-destructive/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">IoT Device Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage your IoT devices</p>
        </div>
        
        <FaultTiles tiles={faultTiles} />
        <DeviceTable devices={devices} />
      </div>
    </div>
  );
};

export default Index;
