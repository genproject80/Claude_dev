import { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface DeviceManagementItem {
  id: string;
  deviceId: string;
  clientName: string;
  model: string;
  firmware: string;
  status: "online" | "offline" | "maintenance" | "fault";
  lastSeen: string;
  location: string;
  faultCount: number;
}

const mockDevices: DeviceManagementItem[] = [
  {
    id: "1",
    deviceId: "P123",
    clientName: "Acme Corporation",
    model: "HV-2000X",
    firmware: "v2.1.4",
    status: "fault",
    lastSeen: "2025-07-23 10:30:00",
    location: "Building A - Floor 3",
    faultCount: 2
  },
  {
    id: "2",
    deviceId: "R146",
    clientName: "TechFlow Industries",
    model: "HV-3000",
    firmware: "v2.0.8",
    status: "online",
    lastSeen: "2025-07-23 10:35:00",
    location: "Production Line 1",
    faultCount: 0
  },
  {
    id: "3",
    deviceId: "Q123",
    clientName: "Green Energy Solutions",
    model: "HV-2500",
    firmware: "v2.1.2",
    status: "offline",
    lastSeen: "2025-07-22 18:45:00",
    location: "Generator Room",
    faultCount: 1
  }
];

export const DeviceManagement = () => {
  const [devices, setDevices] = useState<DeviceManagementItem[]>(mockDevices);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredDevices = devices.filter(device =>
    device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "outline";
      case "offline": return "secondary";
      case "maintenance": return "default";
      case "fault": return "destructive";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online": return <Activity className="h-4 w-4" />;
      case "fault": return <AlertTriangle className="h-4 w-4" />;
      default: return <HardDrive className="h-4 w-4" />;
    }
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
                  <Label htmlFor="deviceId">Device ID</Label>
                  <Input id="deviceId" placeholder="Enter device ID" />
                </div>
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acme">Acme Corporation</SelectItem>
                      <SelectItem value="techflow">TechFlow Industries</SelectItem>
                      <SelectItem value="green">Green Energy Solutions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hv2000x">HV-2000X</SelectItem>
                      <SelectItem value="hv2500">HV-2500</SelectItem>
                      <SelectItem value="hv3000">HV-3000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Enter device location" />
                </div>
                <div className="flex space-x-2 pt-4">
                  <Button onClick={() => setIsAddDialogOpen(false)}>Add Device</Button>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
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
                <TableHead>Client</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Firmware</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Faults</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.deviceId}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{device.clientName}</div>
                      <div className="text-sm text-muted-foreground">{device.location}</div>
                    </div>
                  </TableCell>
                  <TableCell>{device.model}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(device.status)}
                      <Badge variant={getStatusColor(device.status)}>
                        {device.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{device.firmware}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(device.lastSeen).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {device.faultCount > 0 ? (
                      <Badge variant="destructive">
                        {device.faultCount} faults
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
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Activity className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};