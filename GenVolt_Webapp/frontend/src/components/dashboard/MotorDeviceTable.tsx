import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, MapPin, Signal, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MotorDevice } from "@/types/motorDevice";
import { hierarchyApi } from "@/services/api";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface MotorDeviceTableProps {
  devices: MotorDevice[];
}

const ITEMS_PER_PAGE = 10;

export const MotorDeviceTable = ({ devices }: MotorDeviceTableProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof MotorDevice>("entryId");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [clientHierarchy, setClientHierarchy] = useState<Array<{client_id: number, display_name: string, hierarchy_path: string, full_path_name?: string}>>([]);
  const [filters, setFilters] = useState({
    motorStatus: "all",
    faultStatus: "all",
    gsmStrength: "all"
  });

  // Fetch client hierarchy on component mount
  useEffect(() => {
    const fetchClientHierarchy = async () => {
      try {
        const response = await hierarchyApi.getClients();
        if (response.success) {
          setClientHierarchy(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch client hierarchy:', error);
      }
    };
    fetchClientHierarchy();
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchesSearch = (device.deviceId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMotorStatus = filters.motorStatus === "all" || 
        (filters.motorStatus === "on" && device.motorOnTimeSec > device.motorOffTimeSec) ||
        (filters.motorStatus === "off" && device.motorOnTimeSec <= device.motorOffTimeSec);
      const matchesFaultStatus = filters.faultStatus === "all" ||
        (filters.faultStatus === "fault" && device.faultCode > 0) ||
        (filters.faultStatus === "normal" && device.faultCode === 0);
      const matchesGsmStrength = filters.gsmStrength === "all" ||
        (filters.gsmStrength === "strong" && device.gsmSignalStrength > 100) ||
        (filters.gsmStrength === "weak" && device.gsmSignalStrength <= 100);

      return matchesSearch && matchesMotorStatus && matchesFaultStatus && matchesGsmStrength;
    });
  }, [devices, searchTerm, filters]);

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === "asc" 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [filteredDevices, sortField, sortDirection]);

  const handleSort = (field: keyof MotorDevice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const totalPages = Math.ceil(sortedDevices.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getMotorStatusBadge = (motorOnTime: number, motorOffTime: number) => {
    if (motorOnTime > motorOffTime) {
      return <Badge variant="default" className="bg-success text-success-foreground">Running</Badge>;
    }
    return <Badge variant="secondary">Stopped</Badge>;
  };

  const getFaultBadge = (faultCode: number) => {
    if (faultCode === 0) {
      return <Badge variant="secondary" className="bg-success text-success-foreground">Normal</Badge>;
    }
    if (faultCode > 10) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    return <Badge variant="outline" className="border-warning text-warning">Warning</Badge>;
  };

  const getGsmStrengthIcon = (signal: number) => {
    if (signal > 100) {
      return <Signal className="h-4 w-4 text-success" />;
    }
    return <Signal className="h-4 w-4 text-warning" />;
  };

  const handleDeviceClick = (deviceId: string) => {
    navigate(`/motor-device/${deviceId}`);
  };

  const getClientDisplayName = (clientId: string | number | undefined) => {
    if (!clientId) return 'Not assigned';
    
    const client = clientHierarchy.find(c => c.client_id === Number(clientId));
    if (client) {
      // Use full_path_name if available, otherwise construct from hierarchy_path
      return client.full_path_name || client.hierarchy_path.replace(' > ', ' → ') || client.display_name;
    }
    
    return `Client ${clientId}`;
  };

  const SortableHeader = ({ field, children }: { field: keyof MotorDevice; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Motor Devices ({sortedDevices.length})
        </CardTitle>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search by Device ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          
          <div className="flex gap-2">
            <Select value={filters.motorStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, motorStatus: value }))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Motor Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Motors</SelectItem>
                <SelectItem value="on">Running</SelectItem>
                <SelectItem value="off">Stopped</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.faultStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, faultStatus: value }))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Fault Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="fault">Has Faults</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.gsmStrength} onValueChange={(value) => setFilters(prev => ({ ...prev, gsmStrength: value }))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="GSM Signal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Signals</SelectItem>
                <SelectItem value="strong">Strong</SelectItem>
                <SelectItem value="weak">Weak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="entryId">Entry ID</SortableHeader>
                <SortableHeader field="deviceId">Device ID</SortableHeader>
                <TableHead>Client Assignment</TableHead>
                <SortableHeader field="gsmSignalStrength">GSM Signal</SortableHeader>
                <SortableHeader field="motorOnTimeSec">Motor Status</SortableHeader>
                <TableHead>Location</TableHead>
                <SortableHeader field="faultCode">Fault Status</SortableHeader>
                <SortableHeader field="motorCurrentMA">Current (mA)</SortableHeader>
                <SortableHeader field="createdAt">Last Update</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.map((device) => (
                <TableRow 
                  key={device.entryId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleDeviceClick(device.deviceId)}
                >
                  <TableCell className="font-medium">{device.entryId}</TableCell>
                  <TableCell className="font-mono">{device.deviceId}</TableCell>
                  <TableCell className="text-sm">
                    <span className="text-muted-foreground">
                      {getClientDisplayName(device.clientId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getGsmStrengthIcon(device.gsmSignalStrength)}
                      <span>{device.gsmSignalStrength}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getMotorStatusBadge(device.motorOnTimeSec, device.motorOffTimeSec)}</TableCell>
                  <TableCell>
                    {device.latitude !== 0 || device.longitude !== 0 ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-success" />
                        <span className="text-sm">Located</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No GPS</span>
                    )}
                  </TableCell>
                  <TableCell>{getFaultBadge(device.faultCode)}</TableCell>
                  <TableCell className="font-mono">{device.motorCurrentMA}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(device.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};