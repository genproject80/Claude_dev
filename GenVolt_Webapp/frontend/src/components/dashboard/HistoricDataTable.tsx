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
import { Badge } from "@/components/ui/badge";
import { Clock, Activity } from "lucide-react";

interface HistoricDataTableProps {
  deviceId: string;
  historicData: Device[];
}

export const HistoricDataTable = ({ deviceId, historicData }: HistoricDataTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Historic Data for Device {deviceId}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Runtime (min)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>HV Output (kV)</TableHead>
              <TableHead>HV Current (mA)</TableHead>
              <TableHead>Genset Signal</TableHead>
              <TableHead>Thermostat</TableHead>
              <TableHead>Fault Codes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historicData.map((entry) => (
              <TableRow key={entry.entryId}>
                <TableCell className="font-mono text-sm">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>{entry.runtimeMin}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Activity 
                      className={`h-4 w-4 ${
                        entry.faultCodes ? "text-destructive" : "text-success"
                      }`} 
                    />
                    <Badge variant={entry.faultCodes ? "destructive" : "outline"}>
                      {entry.faultCodes ? "Fault" : "Normal"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{entry.hvOutputVoltage_kV}</TableCell>
                <TableCell>{entry.hvOutputCurrent_mA}</TableCell>
                <TableCell>
                  <Badge variant={entry.gensetSignal === "On" ? "default" : "secondary"}>
                    {entry.gensetSignal}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={entry.thermostatStatus === "On" ? "default" : "secondary"}>
                    {entry.thermostatStatus}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {entry.faultCodes || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {historicData.length === 0 && (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Historic Data</h3>
            <p className="text-muted-foreground">No historic entries found for this device</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};