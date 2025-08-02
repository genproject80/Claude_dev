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
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  MoreHorizontal,
  MapPin
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface Client {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  deviceCount: number;
  status: "active" | "inactive" | "pending";
  createdAt: string;
}

const mockClients: Client[] = [
  {
    id: "1",
    name: "Acme Corporation",
    contactPerson: "John Doe",
    email: "john.doe@acme.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Ave, New York, NY 10001",
    deviceCount: 15,
    status: "active",
    createdAt: "2025-01-15"
  },
  {
    id: "2", 
    name: "TechFlow Industries",
    contactPerson: "Sarah Wilson",
    email: "s.wilson@techflow.com",
    phone: "+1 (555) 987-6543",
    address: "456 Industrial Blvd, Chicago, IL 60601",
    deviceCount: 8,
    status: "active",
    createdAt: "2025-02-20"
  },
  {
    id: "3",
    name: "Green Energy Solutions",
    contactPerson: "Mike Thompson",
    email: "mike@greenenergy.com",
    phone: "+1 (555) 456-7890",
    address: "789 Renewable St, Austin, TX 78701",
    deviceCount: 3,
    status: "pending",
    createdAt: "2025-07-10"
  }
];

export const ClientManagement = () => {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredClients = clients.filter(client =>
    (client.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "outline";
      case "inactive": return "secondary";
      case "pending": return "default";
      default: return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Client Management</span>
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Register a new client organization with contact details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Company Name</Label>
                  <Input id="clientName" placeholder="Enter company name" />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input id="contactPerson" placeholder="Enter contact person" />
                </div>
                <div>
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input id="clientEmail" type="email" placeholder="Enter email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="Enter phone number" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" placeholder="Enter complete address" />
                </div>
                <div className="col-span-2 flex space-x-2 pt-4">
                  <Button onClick={() => setIsAddDialogOpen(false)}>Create Client</Button>
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
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {client.address.split(',')[0]}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{client.contactPerson}</div>
                      <div className="text-sm text-muted-foreground">{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {client.deviceCount} devices
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(client.status)}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(client.createdAt).toLocaleDateString()}
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
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
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