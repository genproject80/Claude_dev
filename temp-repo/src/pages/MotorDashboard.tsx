import { useState, useEffect } from "react";
import { FaultTiles } from "@/components/dashboard/FaultTiles";
import { MotorDeviceTable } from "@/components/dashboard/MotorDeviceTable";
import { motorApi } from "@/services/api";
import { MotorDevice, MotorFaultTileData } from "@/types/motorDevice";
import { Loader2 } from "lucide-react";

const MotorDashboard = () => {
  const [motorDevices, setMotorDevices] = useState<MotorDevice[]>([]);
  const [faultTiles, setFaultTiles] = useState<MotorFaultTileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMotorData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch motor devices and dashboard overview in parallel
        const [motorsResponse, overviewResponse] = await Promise.all([
          motorApi.getAll(),
          motorApi.getDashboardOverview()
        ]);

        if (motorsResponse.success) {
          setMotorDevices(motorsResponse.data);
        }

        if (overviewResponse.success) {
          // Transform overview data to fault tiles
          const overview = overviewResponse.data;
          const tiles: MotorFaultTileData[] = [
            {
              title: "Total Motors",
              count: overview.motors?.total_motors || 0,
              severity: "low",
              description: "Active motor devices"
            },
            {
              title: "Motors with Faults",
              count: overview.motors?.motors_with_faults || 0,
              severity: "high",
              description: "Motors reporting fault codes"
            },
            {
              title: "Fault Code 1",
              count: overview.faults?.fault_code_1 || 0,
              severity: "medium",
              description: "Most common fault type"
            },
            {
              title: "Other Faults",
              count: (overview.faults?.fault_code_2 || 0) + (overview.faults?.other_faults || 0),
              severity: "medium",
              description: "Additional fault conditions"
            }
          ];
          setFaultTiles(tiles);
        }

      } catch (err) {
        console.error('Error fetching motor data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load motor data');
      } finally {
        setLoading(false);
      }
    };

    fetchMotorData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading motor dashboard...</p>
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
            <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Motor Dashboard</h2>
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
          <h1 className="text-3xl font-bold">Motor IoT Device Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage your motor control devices</p>
        </div>
        
        <FaultTiles tiles={faultTiles} />
        <MotorDeviceTable devices={motorDevices} />
      </div>
    </div>
  );
};

export default MotorDashboard;