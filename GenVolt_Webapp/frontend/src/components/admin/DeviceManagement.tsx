import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  HardDrive, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  MoreHorizontal,
  Activity,
  AlertTriangle,
  Loader2,
  Eye
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { adminApi, hierarchyApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface DeviceManagementItem {
  id: string;
  deviceId: string;
  channelId: number;
  fieldId?: number;
  clientId: string;
  model: string;
  firmware: string;
  status: "online" | "offline" | "inactive" | "fault";
  lastDataTime: string | null;
  location: string;
  faultCount24h: number;
  apiKey: string;
  conversionLogicId: number;
  faultCodes?: string;
  faultDescriptions?: string;
}

export const DeviceManagement = () => {
  const [devices, setDevices] = useState<DeviceManagementItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceManagementItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientHierarchy, setClientHierarchy] = useState<Array<{client_id: number, display_name: string, hierarchy_path: string, full_path_name?: string}>>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form data states
  const [addFormData, setAddFormData] = useState({
    deviceId: '',
    channelId: '',
    fieldId: '',
    clientId: '',
    apiKey: '',
    conversionLogicId: '',
    model: ''
  });

  const [editFormData, setEditFormData] = useState({
    channelId: '',
    fieldId: '',
    clientId: '',
    apiKey: '',
    conversionLogicId: '',
    model: ''
  });

  // Fetch devices and client hierarchy on component mount
  useEffect(() => {
    fetchDevices();
    fetchClientHierarchy();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getDevices();
      if (response.success) {
        setDevices(response.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch devices",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientHierarchy = async () => {
    try {
      console.log('DeviceManagement: Fetching client hierarchy...');
      const response = await hierarchyApi.getClients();
      console.log('DeviceManagement: Hierarchy response:', response);
      if (response.success) {
        console.log('DeviceManagement: Setting hierarchy data:', response.data);
        console.log('DeviceManagement: First client sample:', response.data[0]);
        setClientHierarchy(response.data);
      } else {
        console.error('DeviceManagement: Hierarchy API failed:', response);
      }
    } catch (error) {
      console.error('DeviceManagement: Failed to fetch client hierarchy:', error);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(`Are you sure you want to remove device ${deviceId} from monitoring?`)) return;

    try {
      const response = await adminApi.deleteDevice(deviceId);
      if (response.success) {
        setDevices(prev => prev.filter(device => device.deviceId !== deviceId));
        toast({
          title: "Success",
          description: "Device removed from monitoring successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete device",
        variant: "destructive"
      });
    }
  };

  const handleEditDevice = async (device: DeviceManagementItem) => {
    try {
      // Get full device details including unmasked API key
      const response = await adminApi.getDeviceById(device.deviceId);
      if (response.success) {
        const fullDevice = response.data.device;
        setSelectedDevice({
          ...device,
          apiKey: fullDevice.apiKey, // Use unmasked API key
          fieldId: fullDevice.fieldId // Ensure we have the correct field ID
        });
        setEditFormData({
          channelId: fullDevice.channelId.toString(),
          fieldId: fullDevice.fieldId ? fullDevice.fieldId.toString() : '',
          clientId: fullDevice.clientId,
          apiKey: fullDevice.apiKey,
          conversionLogicId: fullDevice.conversionLogicId.toString(),
          model: device.model.toLowerCase().replace('-', '')
        });
        setIsEditDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load device details for editing",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (deviceId: string) => {
    navigate(`/device/${deviceId}`);
  };

  const handleAddDevice = async () => {
    try {
      setSubmitting(true);
      
      // Validate required fields
      if (!addFormData.deviceId || !addFormData.channelId || !addFormData.clientId || !addFormData.apiKey || !addFormData.conversionLogicId) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const response = await adminApi.createDevice({
        deviceId: addFormData.deviceId,
        channelId: parseInt(addFormData.channelId),
        fieldId: addFormData.fieldId ? parseInt(addFormData.fieldId) : undefined,
        clientId: addFormData.clientId,
        apiKey: addFormData.apiKey,
        conversionLogicId: parseInt(addFormData.conversionLogicId)
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Device added successfully"
        });
        
        // Reset form and close dialog
        setAddFormData({
          deviceId: '',
          channelId: '',
          fieldId: '',
          clientId: '',
          apiKey: '',
          conversionLogicId: '',
          model: ''
        });
        setIsAddDialogOpen(false);
        
        // Refresh device list
        fetchDevices();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add device",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDevice = async () => {
    if (!selectedDevice) return;
    
    try {
      setSubmitting(true);
      
      // Build update object with only changed fields
      const updateData: any = {};
      
      if (editFormData.channelId && parseInt(editFormData.channelId) !== selectedDevice.channelId) {
        updateData.channelId = parseInt(editFormData.channelId);
      }
      
      if (editFormData.fieldId !== (selectedDevice.fieldId ? selectedDevice.fieldId.toString() : '')) {
        updateData.fieldId = editFormData.fieldId ? parseInt(editFormData.fieldId) : null;
      }
      
      if (editFormData.clientId && editFormData.clientId !== selectedDevice.clientId) {
        updateData.clientId = editFormData.clientId;
      }
      
      if (editFormData.apiKey && editFormData.apiKey !== selectedDevice.apiKey) {
        updateData.apiKey = editFormData.apiKey;
      }
      
      if (editFormData.conversionLogicId && parseInt(editFormData.conversionLogicId) !== selectedDevice.conversionLogicId) {
        updateData.conversionLogicId = parseInt(editFormData.conversionLogicId);
      }

      if (Object.keys(updateData).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes detected to save",
          variant: "default"
        });
        return;
      }
      
      const response = await adminApi.updateDevice(selectedDevice.deviceId, updateData);

      if (response.success) {
        toast({
          title: "Success",
          description: "Device updated successfully"
        });
        
        setIsEditDialogOpen(false);
        setSelectedDevice(null);
        
        // Refresh device list
        fetchDevices();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update device",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDevices = devices.filter(device =>
    (device.deviceId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.clientId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.model || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "outline";
      case "offline": return "secondary";
      case "inactive": return "default";
      case "fault": return "destructive";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online": return <Activity className="h-4 w-4 text-green-500" />;
      case "offline": return <HardDrive className="h-4 w-4 text-gray-500" />;
      case "inactive": return <HardDrive className="h-4 w-4 text-yellow-500" />;
      case "fault": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <HardDrive className="h-4 w-4" />;
    }
  };

  const getDeviceStatus = (device: DeviceManagementItem) => {
    if (device.faultCodes && device.faultCodes.trim() !== '') {
      return 'fault';
    }
    return device.status;
  };

  const getClientDisplayName = (clientId: string | number | undefined) => {
    if (!clientId) return 'Not assigned';
    
    const client = clientHierarchy.find(c => c.client_id === Number(clientId));
    if (client) {
      // Try different fields and build hierarchy path from display names
      if (client.full_path_name && !client.full_path_name.includes('/')) {
        return client.full_path_name;
      }
      
      // If we have hierarchy_path with IDs, try to build path with names
      if (client.hierarchy_path && client.hierarchy_path.includes('/')) {
        // This is likely /1/2 format, so let's try to build a proper path
        return buildClientHierarchyPath(client);
      }
      
      // Fall back to display_name
      return client.display_name || `Client ${client.client_id}`;
    }
    
    return `Client ${clientId}`;
  };

  const buildClientHierarchyPath = (targetClient: any) => {
    // Try to build hierarchy path using display names
    const pathParts = [];
    let current = targetClient;
    
    // Add current client name
    pathParts.unshift(current.display_name || `Client ${current.client_id}`);
    
    // Try to find parent clients by searching through the hierarchy
    while (current.parent_client_id) {
      const parent = clientHierarchy.find(c => c.client_id === current.parent_client_id);
      if (parent) {
        pathParts.unshift(parent.display_name || `Client ${parent.client_id}`);
        current = parent;
      } else {
        break;
      }
    }
    
    return pathParts.join(' → ');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>Device Management</span>
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Device</DialogTitle>
                <DialogDescription>
                  Register a new device to the monitoring system.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deviceId">Device ID *</Label>
                  <Input 
                    id="deviceId" 
                    value={addFormData.deviceId}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, deviceId: e.target.value }))}
                    placeholder="Enter device ID (e.g., P123, R146)" 
                  />
                </div>
                <div>
                  <Label htmlFor="channelId">Channel ID *</Label>
                  <Input 
                    id="channelId" 
                    type="number"
                    value={addFormData.channelId}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, channelId: e.target.value }))}
                    placeholder="Enter ThingSpeak channel ID (e.g., 2878685)" 
                  />
                </div>
                <div>
                  <Label htmlFor="fieldId">Field ID</Label>
                  <Input 
                    id="fieldId" 
                    type="number"
                    value={addFormData.fieldId}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, fieldId: e.target.value }))}
                    placeholder="Enter field ID (1-8)" 
                    min="1"
                    max="8"
                  />
                </div>
                <div>
                  <Label htmlFor="clientId">Client Assignment * (TEST - Hierarchy count: {clientHierarchy.length})</Label>
                  <Select 
                    value={addFormData.clientId} 
                    onValueChange={(value) => setAddFormData(prev => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientHierarchy.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Loading clients... (count: {clientHierarchy.length})
                        </SelectItem>
                      ) : (
                        clientHierarchy.map((client) => {
                          const displayName = buildClientHierarchyPath(client);
                          console.log('Adding dropdown option:', { client_id: client.client_id, displayName, raw_client: client });
                          return (
                            <SelectItem key={client.client_id} value={client.client_id.toString()}>
                              {displayName}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Debug: clientHierarchy length = {clientHierarchy.length}, 
                    Selected value = {addFormData.clientId}
                  </p>
                </div>
                <div>
                  <Label htmlFor="apiKey">API Key *</Label>
                  <Input 
                    id="apiKey" 
                    value={addFormData.apiKey}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter ThingSpeak API key" 
                  />
                </div>
                <div>
                  <Label htmlFor="conversionLogicId">Conversion Logic ID *</Label>
                  <Input 
                    id="conversionLogicId" 
                    type="number"
                    value={addFormData.conversionLogicId}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, conversionLogicId: e.target.value }))}
                    placeholder="Enter conversion logic ID (1 or 2)" 
                    min="1"
                    max="2"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Select value={addFormData.model} onValueChange={(value) => setAddFormData(prev => ({ ...prev, model: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select device model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hv2000x">HV-2000X</SelectItem>
                      <SelectItem value="hv2500">HV-2500</SelectItem>
                      <SelectItem value="hv3000">HV-3000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-2 pt-4">
                  <Button onClick={handleAddDevice} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add Device
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>Client Assignment & Channel</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Last Data</TableHead>
                <TableHead>Faults (24h)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading devices...</p>
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">No devices found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => {
                  const deviceStatus = getDeviceStatus(device);
                  return (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium font-mono">{device.deviceId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {getClientDisplayName(device.clientId)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Channel {device.channelId}{device.fieldId ? ` • Field ${device.fieldId}` : ''} • {device.location}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.model}</div>
                          <div className="text-sm text-muted-foreground">{device.firmware}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(deviceStatus)}
                          <Badge variant={getStatusColor(deviceStatus)}>
                            {deviceStatus}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{device.apiKey}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {device.lastDataTime 
                          ? new Date(device.lastDataTime).toLocaleString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {device.faultCount24h > 0 ? (
                          <Badge variant="destructive">
                            {device.faultCount24h} faults
                          </Badge>
                        ) : (
                          <Badge variant="outline">No faults</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditDevice(device)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(device.deviceId)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteDevice(device.deviceId)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Device Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Device Configuration</DialogTitle>
              <DialogDescription>
                Update device settings and configuration.
              </DialogDescription>
            </DialogHeader>
            {selectedDevice && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editDeviceId">Device ID</Label>
                  <Input 
                    id="editDeviceId" 
                    value={selectedDevice.deviceId} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="editChannelId">Channel ID</Label>
                  <Input 
                    id="editChannelId" 
                    type="number"
                    value={editFormData.channelId}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, channelId: e.target.value }))}
                    placeholder="ThingSpeak channel ID"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Current: {selectedDevice.channelId} • Used for ThingSpeak data channel
                  </p>
                </div>
                <div>
                  <Label htmlFor="editFieldId">Field ID</Label>
                  <Input 
                    id="editFieldId" 
                    type="number"
                    value={editFormData.fieldId}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, fieldId: e.target.value }))}
                    placeholder="Enter field ID (1-8)"
                    min="1"
                    max="8"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Current: {selectedDevice.fieldId || 'Not set'} • ThingSpeak field number (1-8) for data mapping
                  </p>
                </div>
                <div>
                  <Label htmlFor="editClientId">Client Assignment</Label>
                  <Select 
                    value={editFormData.clientId} 
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientHierarchy.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Loading clients...
                        </SelectItem>
                      ) : (
                        <>
                          {/* Include current client if not in hierarchy list */}
                          {selectedDevice?.clientId && !clientHierarchy.find(c => c.client_id === Number(selectedDevice.clientId)) && (
                            <SelectItem key={selectedDevice.clientId} value={selectedDevice.clientId}>
                              Client {selectedDevice.clientId} (Current)
                            </SelectItem>
                          )}
                          {clientHierarchy.map((client) => (
                            <SelectItem key={client.client_id} value={client.client_id.toString()}>
                              {client.full_path_name || client.hierarchy_path.replace(' > ', ' → ') || client.display_name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current: {getClientDisplayName(selectedDevice?.clientId)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="editApiKey">API Key</Label>
                  <Input 
                    id="editApiKey" 
                    value={editFormData.apiKey}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="ThingSpeak API key"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Current (masked): {selectedDevice.apiKey}
                  </p>
                </div>
                <div>
                  <Label htmlFor="editConversionLogicId">Conversion Logic ID</Label>
                  <Input 
                    id="editConversionLogicId" 
                    type="number"
                    value={editFormData.conversionLogicId}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, conversionLogicId: e.target.value }))}
                    placeholder="1 or 2"
                    min="1"
                    max="2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Data conversion algorithm (1 = Standard, 2 = Enhanced)
                  </p>
                </div>
                <div>
                  <Label htmlFor="editModel">Device Model</Label>
                  <Select value={editFormData.model} onValueChange={(value) => setEditFormData(prev => ({ ...prev, model: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select device model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hv2000x">HV-2000X</SelectItem>
                      <SelectItem value="hv2500">HV-2500</SelectItem>
                      <SelectItem value="hv3000">HV-3000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-2 pt-4">
                  <Button onClick={handleUpdateDevice} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Update Device
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};