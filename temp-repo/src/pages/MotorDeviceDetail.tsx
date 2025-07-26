import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Activity, Zap, MapPin, Signal, Loader2, Settings, Gauge } from "lucide-react";
import { motorApi } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MotorDeviceData {
  deviceId: string;
  latestData: {
    entryId: number;
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
  };
  dataPoints: any[];
}

export const MotorDeviceDetail = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  
  const [device, setDevice] = useState<MotorDeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMotorDeviceData = async () => {
      if (!deviceId) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await motorApi.getById(deviceId);

        if (response.success) {
          setDevice(response.data);
        } else {
          setError('Failed to load motor device data');
        }

      } catch (err) {
        console.error('Error fetching motor device data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load motor device data');
      } finally {
        setLoading(false);
      }
    };

    fetchMotorDeviceData();
  }, [deviceId]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading motor device details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Motor Device</h2>
            <p className="text-destructive/80 mb-4">{error}</p>
            <Button onClick={() => navigate("/motor-dashboard")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Motor Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Motor Device Not Found</h1>
          <Button onClick={() => navigate("/motor-dashboard")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Motor Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { latestData } = device;

  const getMotorStatusIcon = () => {
    if (latestData.motorOnTimeSec > latestData.motorOffTimeSec) {
      return <Activity className="h-6 w-6 text-success" />;
    }
    return <Activity className="h-6 w-6 text-muted-foreground" />;
  };

  const getFaultSeverityIcon = (faultCode: number) => {
    if (faultCode === 0) {
      return <Activity className="h-6 w-6 text-success" />;
    }
    if (faultCode > 10) {
      return <AlertTriangle className="h-6 w-6 text-destructive" />;
    }
    return <AlertTriangle className="h-6 w-6 text-warning" />;
  };

  const getMotorStatusBadge = () => {
    if (latestData.motorOnTimeSec > latestData.motorOffTimeSec) {
      return <Badge className="bg-success text-success-foreground">Running</Badge>;
    }
    return <Badge variant="secondary">Stopped</Badge>;
  };

  const getFaultBadge = (faultCode: number) => {
    if (faultCode === 0) {
      return <Badge variant="secondary" className="bg-success text-success-foreground">Normal</Badge>;
    }
    if (faultCode > 10) {
      return <Badge variant="destructive">Critical Fault</Badge>;
    }
    return <Badge variant="outline" className="border-warning text-warning">Warning</Badge>;
  };

  const getGsmStrengthBadge = (signal: number) => {
    if (signal > 150) {
      return <Badge className="bg-success text-success-foreground">Excellent</Badge>;
    } else if (signal > 100) {
      return <Badge className="bg-success text-success-foreground">Good</Badge>;
    } else if (signal > 50) {
      return <Badge variant="outline" className="border-warning text-warning">Fair</Badge>;
    }
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => navigate("/motor-dashboard")} 
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Motor Device {device.deviceId}</h1>
              <p className="text-muted-foreground">Detailed motor device information and diagnostics</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getMotorStatusIcon()}
            {getMotorStatusBadge()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID:</span>
                <span className="font-medium">{device.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry ID:</span>
                <span className="font-medium">#{latestData.entryId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Update:</span>
                <span className="font-medium text-sm">{new Date(latestData.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="font-medium text-sm">{new Date(latestData.timestamp).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Motor Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Motor Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {getMotorStatusBadge()}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ON Time:</span>
                <span className="font-medium">{latestData.motorOnTimeSec} sec</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OFF Time:</span>
                <span className="font-medium">{latestData.motorOffTimeSec} sec</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-medium">{latestData.motorCurrentMA} mA</span>
              </div>
            </CardContent>
          </Card>

          {/* Communication & GPS Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5" />
                Communication & GPS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">GSM Signal:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{latestData.gsmSignalStrength}</span>
                  {getGsmStrengthBadge(latestData.gsmSignalStrength)}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPS Location:</span>
                {latestData.latitude !== 0 || latestData.longitude !== 0 ? (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Available</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not Available</span>
                )}
              </div>
              {(latestData.latitude !== 0 || latestData.longitude !== 0) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latitude:</span>
                    <span className="font-medium">{latestData.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Longitude:</span>
                    <span className="font-medium">{latestData.longitude.toFixed(6)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Wheel Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Wheel Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Configured:</span>
                <span className="font-medium">{latestData.wheelsConfigured}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detected:</span>
                <span className="font-medium">{latestData.wheelsDetected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detection Rate:</span>
                <span className="font-medium">
                  {latestData.wheelsConfigured > 0 
                    ? `${((latestData.wheelsDetected / latestData.wheelsConfigured) * 100).toFixed(1)}%`
                    : 'N/A'
                  }
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Fault Information Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getFaultSeverityIcon(latestData.faultCode)}
                <span>Fault Information & Diagnostics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestData.faultCode > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Fault Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-destructive">{latestData.faultCode}</span>
                      {getFaultBadge(latestData.faultCode)}
                    </div>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <h4 className="font-medium text-destructive mb-2">Fault Detected</h4>
                    <p className="text-sm text-destructive/80">
                      Motor device is reporting fault code {latestData.faultCode}. 
                      {latestData.faultCode > 10 ? ' This is a critical fault that requires immediate attention.' : ' This is a warning condition that should be monitored.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-success mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-success">No Faults Detected</h3>
                  <p className="text-muted-foreground">Motor device is operating normally</p>
                  <div className="flex gap-2 justify-center mt-4">
                    {getMotorStatusBadge()}
                    <Badge variant="outline">
                      Current: {latestData.motorCurrentMA}mA
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technical Details Card */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Technical Details & Raw Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Performance Metrics</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Motor ON Time:</span>
                      <span className="font-medium">{latestData.motorOnTimeSec} seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Motor OFF Time:</span>
                      <span className="font-medium">{latestData.motorOffTimeSec} seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Draw:</span>
                      <span className="font-medium">{latestData.motorCurrentMA} mA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duty Cycle:</span>
                      <span className="font-medium">
                        {latestData.motorOnTimeSec + latestData.motorOffTimeSec > 0 
                          ? `${((latestData.motorOnTimeSec / (latestData.motorOnTimeSec + latestData.motorOffTimeSec)) * 100).toFixed(1)}%`
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Raw Hex Data</h4>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="font-mono text-xs break-all">
                      {latestData.hexField || "No hex data available"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Historical Data Section */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Historical Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry ID</TableHead>
                      <TableHead>GSM Signal</TableHead>
                      <TableHead>Motor Status</TableHead>
                      <TableHead>Current (mA)</TableHead>
                      <TableHead>Wheels</TableHead>
                      <TableHead>Fault Code</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {device.dataPoints.slice(0, 10).map((point) => (
                      <TableRow key={point.entryId}>
                        <TableCell className="font-medium">#{point.entryId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Signal className={`h-4 w-4 ${point.gsmSignalStrength > 100 ? 'text-success' : 'text-warning'}`} />
                            {point.gsmSignalStrength}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={point.motorOnTimeSec > point.motorOffTimeSec ? "default" : "secondary"}>
                            {point.motorOnTimeSec > point.motorOffTimeSec ? "Running" : "Stopped"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{point.motorCurrentMA}</TableCell>
                        <TableCell>{point.wheelsDetected}/{point.wheelsConfigured}</TableCell>
                        <TableCell>
                          <Badge variant={point.faultCode === 0 ? "secondary" : point.faultCode > 10 ? "destructive" : "outline"}>
                            {point.faultCode === 0 ? "Normal" : `Fault ${point.faultCode}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(point.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};