import { useState, useMemo } from "react";
import { Device } from "@/types/device";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DeviceTableProps {
  devices: Device[];
}

const ITEMS_PER_PAGE = 10;

export const DeviceTable = ({ devices }: DeviceTableProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Device>("entryId");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    gensetSignal: "",
    thermostatStatus: "",
    hasErrors: ""
  });

  // Filter and search logic
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchesSearch = device.deviceId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenset = !filters.gensetSignal || device.gensetSignal === filters.gensetSignal;
      const matchesThermostat = !filters.thermostatStatus || device.thermostatStatus === filters.thermostatStatus;
      const matchesErrors = !filters.hasErrors || 
        (filters.hasErrors === "yes" && device.faultCodes) ||
        (filters.hasErrors === "no" && !device.faultCodes);
      
      return matchesSearch && matchesGenset && matchesThermostat && matchesErrors;
    });
  }, [devices, searchTerm, filters]);

  // Sort logic
  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }, [filteredDevices, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedDevices.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSort = (field: keyof Device) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleDeviceClick = (deviceId: string) => {
    navigate(`/device/${deviceId}`);
  };

  const getSeverityBadge = (faultCodes: string) => {
    if (!faultCodes) {
      return <Badge variant="outline" className="text-success border-success">Normal</Badge>;
    }
    
    if (faultCodes.includes("13") || faultCodes.includes("1")) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    
    return <Badge variant="secondary" className="text-warning border-warning">Warning</Badge>;
  };

  const SortableHeader = ({ field, children }: { field: keyof Device; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">IoT Device Monitor</CardTitle>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Device ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Genset Signal
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilters({...filters, gensetSignal: ""})}>
                  All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({...filters, gensetSignal: "On"})}>
                  On
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({...filters, gensetSignal: "Off"})}>
                  Off
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilters({...filters, hasErrors: ""})}>
                  All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({...filters, hasErrors: "yes"})}>
                  Has Faults
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({...filters, hasErrors: "no"})}>
                  Normal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="deviceId">Device ID</SortableHeader>
                <SortableHeader field="runtimeMin">Runtime (min)</SortableHeader>
                <SortableHeader field="faultDescriptions">Fault Status</SortableHeader>
                <SortableHeader field="gensetSignal">Genset</SortableHeader>
                <SortableHeader field="thermostatStatus">Thermostat</SortableHeader>
                <SortableHeader field="hvOutputVoltage_kV">HV Output (kV)</SortableHeader>
                <SortableHeader field="createdAt">Last Update</SortableHeader>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.map((device) => (
                <TableRow 
                  key={device.entryId}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleDeviceClick(device.deviceId)}
                >
                  <TableCell className="font-medium">{device.deviceId}</TableCell>
                  <TableCell>{device.runtimeMin}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getSeverityBadge(device.faultCodes)}
                      {device.faultDescriptions && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {device.faultDescriptions}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.gensetSignal === "On" ? "default" : "secondary"}>
                      {device.gensetSignal}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.thermostatStatus === "On" ? "default" : "secondary"}>
                      {device.thermostatStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{device.hvOutputVoltage_kV}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(device.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeviceClick(device.deviceId);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sortedDevices.length)} of {sortedDevices.length} devices
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};