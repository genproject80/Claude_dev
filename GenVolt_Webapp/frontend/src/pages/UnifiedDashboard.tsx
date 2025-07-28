import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaultTiles } from "@/components/dashboard/FaultTiles";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { MotorDeviceTable } from "@/components/dashboard/MotorDeviceTable";
import { deviceApi, dashboardApi, motorApi } from "@/services/api";
import { Device, FaultTileData } from "@/types/device";
import { MotorDevice, MotorFaultTileData } from "@/types/motorDevice";
import FrontendPermissionService from "@/services/permissionService";

const UnifiedDashboard = () => {
  const { user } = useAuth();
  
  // IoT Dashboard State
  const [devices, setDevices] = useState<Device[]>([]);
  const [faultTiles, setFaultTiles] = useState<FaultTileData[]>([]);
  const [iotLoading, setIotLoading] = useState(true);
  const [iotError, setIotError] = useState<string | null>(null);

  // Motor Dashboard State
  const [motorDevices, setMotorDevices] = useState<MotorDevice[]>([]);
  const [motorFaultTiles, setMotorFaultTiles] = useState<MotorFaultTileData[]>([]);
  const [motorLoading, setMotorLoading] = useState(true);
  const [motorError, setMotorError] = useState<string | null>(null);

  // Permission-based rendering state
  const [canAccessIoT, setCanAccessIoT] = useState(false);
  const [canAccessMotor, setCanAccessMotor] = useState(false);
  const [shouldShowTabs, setShouldShowTabs] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Active tab for admin users
  const [activeTab, setActiveTab] = useState("iot");

  // Check permissions using the new permission service
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user?.role) {
        setPermissionsLoading(false);
        return;
      }

      try {
        setPermissionsLoading(true);
        
        const [iotAccess, motorAccess, showTabs] = await Promise.all([
          FrontendPermissionService.canAccessIoTDashboard(user.role, user.clientId),
          FrontendPermissionService.canAccessMotorDashboard(user.role, user.clientId),
          FrontendPermissionService.shouldShowBothDashboards(user.role, user.clientId)
        ]);

        console.log('Permission check results:', { iotAccess, motorAccess, showTabs });

        setCanAccessIoT(iotAccess);
        setCanAccessMotor(motorAccess);
        setShouldShowTabs(showTabs);
      } catch (error) {
        console.error('Error checking permissions:', error);
        // Fallback to default behavior
        const fallbackIoTAccess = true; // Most users should have IoT access
        const fallbackMotorAccess = user?.role === 'admin' || user?.role === 'dashboard_viewer';
        const fallbackShowTabs = user?.role === 'admin' || user?.role === 'dashboard_viewer';
        
        console.log('Using fallback permissions:', { 
          iot: fallbackIoTAccess, 
          motor: fallbackMotorAccess, 
          tabs: fallbackShowTabs 
        });
        
        setCanAccessIoT(fallbackIoTAccess);
        setCanAccessMotor(fallbackMotorAccess);
        setShouldShowTabs(fallbackShowTabs);
      } finally {
        setPermissionsLoading(false);
      }
    };

    checkPermissions();
  }, [user]);

  // Legacy permission functions for backward compatibility
  const shouldShowIoTDashboard = () => canAccessIoT;
  const shouldShowMotorDashboard = () => canAccessMotor;

  // Determine default tab based on user permissions
  useEffect(() => {
    if (permissionsLoading) return;
    
    if (shouldShowTabs) {
      setActiveTab("iot"); // Default to IoT if user can see both
    } else if (canAccessMotor && !canAccessIoT) {
      setActiveTab("motor"); // Motor dashboard only
    } else {
      setActiveTab("iot"); // Default to IoT
    }
  }, [shouldShowTabs, canAccessIoT, canAccessMotor, permissionsLoading]);

  // Fetch IoT Dashboard data
  const fetchIoTData = async () => {
    if (!shouldShowIoTDashboard()) {
      setIotLoading(false);
      return;
    }
    
    try {
      setIotLoading(true);
      setIotError(null);

      const [devicesResponse, overviewResponse] = await Promise.all([
        deviceApi.getAll(),
        dashboardApi.getOverview()
      ]);

      if (devicesResponse.success) {
        const transformedDevices: Device[] = devicesResponse.data.map((apiDevice: any, index: number) => ({
          entryId: apiDevice.latestData?.entryId || (1000000 + index),
          runtimeMin: apiDevice.latestData?.runtimeMin || 0,
          faultCodes: apiDevice.latestData?.faultCodes || "",
          faultDescriptions: "",
          leadingFaultCode: 0,
          leadingFaultTimeHr: 0,
          gensetSignal: "Unknown",
          thermostatStatus: "Unknown",
          hvOutputVoltage_kV: 0,
          hvSourceNo: 0,
          hvOutputCurrent_mA: 0,
          hexField: "",
          createdAt: apiDevice.latestData?.timestamp || new Date().toISOString(),
          deviceId: apiDevice.id
        }));
        setDevices(transformedDevices);
      }

      if (overviewResponse.success) {
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
      console.error('Error fetching IoT dashboard data:', err);
      setIotError(err instanceof Error ? err.message : 'Failed to load IoT data');
    } finally {
      setIotLoading(false);
    }
  };

  // Fetch Motor Dashboard data
  const fetchMotorData = async () => {
    if (!shouldShowMotorDashboard()) {
      setMotorLoading(false);
      return;
    }
    
    try {
      setMotorLoading(true);
      setMotorError(null);

      const [motorsResponse, overviewResponse] = await Promise.all([
        motorApi.getAll(),
        motorApi.getDashboardOverview()
      ]);

      if (motorsResponse.success) {
        setMotorDevices(motorsResponse.data);
      }

      if (overviewResponse.success) {
        const overview = overviewResponse.data;
        const tiles: MotorFaultTileData[] = [
          {
            title: "Critical Motor Faults",
            count: overview.faults?.critical || 0,
            severity: "high",
            description: "Motors with critical faults"
          },
          {
            title: "Warning Faults",
            count: overview.faults?.warning || 0,
            severity: "medium", 
            description: "Motors with warning conditions"
          },
          {
            title: "Active Motors",
            count: overview.motors?.active || 0,
            severity: "low",
            description: "Currently active motors"
          },
          {
            title: "Total Motors",
            count: overview.motors?.total || 0,
            severity: "low",
            description: "Total monitored motors"
          }
        ];
        setMotorFaultTiles(tiles);
      }
    } catch (err) {
      console.error('Error fetching motor dashboard data:', err);
      setMotorError(err instanceof Error ? err.message : 'Failed to load motor data');
    } finally {
      setMotorLoading(false);
    }
  };

  useEffect(() => {
    if (user && !permissionsLoading) {
      fetchIoTData();
      fetchMotorData();
    }
  }, [user, permissionsLoading, canAccessIoT, canAccessMotor]);

  // Loading state
  if (permissionsLoading || (canAccessIoT && iotLoading) || (canAccessMotor && motorLoading)) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                {permissionsLoading ? "Loading permissions..." : "Loading dashboard..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if ((canAccessIoT && iotError) || (canAccessMotor && motorError)) {
    const errorMessage = iotError || motorError;
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Dashboard</h2>
            <p className="text-destructive/80">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render dashboard based on user permissions
  const renderDashboardContent = () => {
    // Users with access to both dashboards see tabs
    if (shouldShowTabs) {
      return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iot" disabled={!canAccessIoT}>IoT Devices</TabsTrigger>
            <TabsTrigger value="motor" disabled={!canAccessMotor}>Motor Devices</TabsTrigger>
          </TabsList>
          
          {canAccessIoT && (
            <TabsContent value="iot" className="space-y-6">
              <FaultTiles tiles={faultTiles} />
              <DeviceTable devices={devices} />
            </TabsContent>
          )}
          
          {canAccessMotor && (
            <TabsContent value="motor" className="space-y-6">
              <FaultTiles tiles={motorFaultTiles} />
              <MotorDeviceTable devices={motorDevices} />
            </TabsContent>
          )}
        </Tabs>
      );
    }

    // Users with single dashboard access
    if (canAccessMotor && !canAccessIoT) {
      // Motor dashboard only
      return (
        <div className="space-y-6">
          <FaultTiles tiles={motorFaultTiles} />
          <MotorDeviceTable devices={motorDevices} />
        </div>
      );
    }

    // Default: IoT dashboard (or if user has IoT access only)
    if (canAccessIoT) {
      return (
        <div className="space-y-6">
          <FaultTiles tiles={faultTiles} />
          <DeviceTable devices={devices} />
        </div>
      );
    }

    // No access to any dashboard
    return (
      <div className="text-center p-8">
        <h2 className="text-lg font-semibold text-muted-foreground mb-2">No Dashboard Access</h2>
        <p className="text-muted-foreground">You don't have permission to access any dashboards.</p>
      </div>
    );
  };

  // Determine page title
  const getPageTitle = () => {
    if (shouldShowTabs) {
      return activeTab === "iot" ? "IoT Device Dashboard" : "Motor Device Dashboard";
    }
    if (canAccessMotor && !canAccessIoT) {
      return "Motor Device Dashboard";
    }
    if (canAccessIoT) {
      return "IoT Device Dashboard";
    }
    return "Dashboard";
  };

  const getPageDescription = () => {
    if (shouldShowTabs) {
      return activeTab === "iot" 
        ? "Monitor and manage your IoT devices" 
        : "Monitor and manage your motor devices";
    }
    if (canAccessMotor && !canAccessIoT) {
      return "Monitor and manage your motor devices";
    }
    if (canAccessIoT) {
      return "Monitor and manage your IoT devices";
    }
    return "Select a dashboard to view";
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{getPageTitle()}</h1>
          <p className="text-muted-foreground">{getPageDescription()}</p>
        </div>
        
        {renderDashboardContent()}
      </div>
    </div>
  );
};

export default UnifiedDashboard;