import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Database, Shield, Activity, Building2, HardDrive, TrendingUp, Loader2 } from "lucide-react";
import { UserManagement } from "@/components/admin/UserManagement";
import { ClientManagement } from "@/components/admin/ClientManagement";
import { DeviceManagement } from "@/components/admin/DeviceManagement";
import { SessionManagement } from "@/components/admin/SessionManagement";
import RoleManagement from "@/components/admin/RoleManagement";
import { adminApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export const Admin = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch system statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">System administration and configuration</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>User Management</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Role Management</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Client Management</span>
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4" />
              <span>Device Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionManagement />
          </TabsContent>

          <TabsContent value="clients">
            <ClientManagement />
          </TabsContent>

          <TabsContent value="devices">
            <DeviceManagement />
          </TabsContent>
        </Tabs>

        {/* System Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>Total Users</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{stats?.users?.total_users || 0}</div>
                  <div className="text-sm text-muted-foreground">
                    {stats?.users?.admin_users || 0} admins
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <HardDrive className="h-4 w-4 text-primary" />
                <span>Total Devices</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{stats?.devices?.total_devices || 0}</div>
                  <Badge variant="outline" className="text-success border-success">Active</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Database className="h-4 w-4 text-primary" />
                <span>IoT Data Records</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{(stats?.iotData?.total_iot_records || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">
                    {stats?.recentActivity?.recent_iot_readings || 0} recent
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>Motor Data Records</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{(stats?.motorData?.total_motor_records || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">
                    {stats?.recentActivity?.recent_motor_readings || 0} recent
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Admin Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "User 'john.doe@company.com' was created", time: "2 hours ago", type: "user" },
                { action: "Device P123 configuration updated", time: "4 hours ago", type: "device" },
                { action: "Client 'Acme Corporation' was added", time: "6 hours ago", type: "client" },
                { action: "Security policy updated", time: "1 day ago", type: "security" },
                { action: "System backup completed", time: "2 days ago", type: "system" }
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activity.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};