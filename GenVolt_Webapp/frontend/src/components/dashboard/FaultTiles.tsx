import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Activity, Zap, CheckCircle } from "lucide-react";
import { FaultTileData } from "@/types/device";

interface FaultTilesProps {
  tiles: FaultTileData[];
}

const getIcon = (severity: string) => {
  switch (severity) {
    case "high":
      return <AlertTriangle className="h-6 w-6 text-destructive" />;
    case "medium":
      return <Zap className="h-6 w-6 text-warning" />;
    case "low":
      return <CheckCircle className="h-6 w-6 text-success" />;
    default:
      return <Activity className="h-6 w-6 text-info" />;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case "high":
      return "border-l-4 border-l-destructive bg-gradient-to-r from-destructive/5 to-transparent";
    case "medium":
      return "border-l-4 border-l-warning bg-gradient-to-r from-warning/5 to-transparent";
    case "low":
      return "border-l-4 border-l-success bg-gradient-to-r from-success/5 to-transparent";
    default:
      return "border-l-4 border-l-info bg-gradient-to-r from-info/5 to-transparent";
  }
};

export const FaultTiles = ({ tiles }: FaultTilesProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {tiles.map((tile, index) => (
        <Card 
          key={index} 
          className={`hover:shadow-lg transition-all duration-300 cursor-pointer ${getSeverityStyles(tile.severity)}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tile.title}
            </CardTitle>
            {getIcon(tile.severity)}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-1">
              {tile.count}
            </div>
            <p className="text-xs text-muted-foreground">
              {tile.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};