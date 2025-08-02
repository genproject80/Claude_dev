import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Users,
  HardDrive,
  Folder,
  FolderOpen
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface HierarchicalClient {
  client_id: number;
  client_name: string;
  display_name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  parent_client_id?: number;
  hierarchy_level: number;
  hierarchy_path: string;
  client_type: 'root' | 'enterprise' | 'division' | 'department' | 'site' | 'client';
  is_leaf_node: boolean;
  display_order: number;
  is_active: boolean;
  full_path_name?: string;
  indented_name?: string;
  device_count?: number;
  child_count?: number;
  created_at: string;
  updated_at: string;
}

export const HierarchicalClientManagement = () => {
  const [clients, setClients] = useState<HierarchicalClient[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set([1])); // GenVolt expanded by default
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch client hierarchy from API
  const fetchClientHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:3003/api/v1/hierarchy/clients', {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setClients(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch client hierarchy');
      }
    } catch (err) {
      console.error('Error fetching client hierarchy:', err);
      setError(err instanceof Error ? err.message : 'Failed to load client hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientHierarchy();
  }, []);

  // Toggle node expansion
  const toggleNode = (clientId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedNodes(newExpanded);
  };

  // Get children of a client
  const getClientChildren = (parentId: number) => {
    return clients.filter(client => client.parent_client_id === parentId);
  };

  // Check if client has children
  const hasChildren = (clientId: number) => {
    return clients.some(client => client.parent_client_id === clientId);
  };

  // Filter clients based on search term
  const getFilteredClients = () => {
    if (!searchTerm.trim()) {
      return clients;
    }
    
    return clients.filter(client =>
      (client.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Render client tree recursively
  const renderClientTree = (parentId: number | null = null, level: number = 0) => {
    const filteredClients = getFilteredClients();
    const children = filteredClients.filter(client => client.parent_client_id === parentId);
    
    return children.map(client => {
      const isExpanded = expandedNodes.has(client.client_id);
      const clientHasChildren = hasChildren(client.client_id);
      
      return (
        <div key={client.client_id} className="select-none">
          {/* Client Row */}
          <div 
            className={`flex items-center py-2 px-2 hover:bg-muted/50 rounded-md cursor-pointer ${
              level > 0 ? 'ml-6' : ''
            }`}
            style={{ paddingLeft: `${level * 24 + 8}px` }}
          >
            {/* Expand/Collapse Button */}
            <div className="w-6 h-6 flex items-center justify-center mr-2">
              {clientHasChildren ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleNode(client.client_id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-4 h-4" />
              )}
            </div>

            {/* Client Icon */}
            <div className="mr-3">
              {client.client_type === 'root' ? (
                <Building2 className="h-5 w-5 text-blue-600" />
              ) : clientHasChildren ? (
                isExpanded ? (
                  <FolderOpen className="h-5 w-5 text-yellow-600" />
                ) : (
                  <Folder className="h-5 w-5 text-yellow-600" />
                )
              ) : (
                <Users className="h-5 w-5 text-green-600" />
              )}
            </div>

            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-sm">
                  {client.display_name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {client.client_type}
                </Badge>
                {client.device_count !== undefined && client.device_count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <HardDrive className="h-3 w-3 mr-1" />
                    {client.device_count}
                  </Badge>
                )}
              </div>
              {client.contact_email && (
                <div className="text-xs text-muted-foreground mt-1">
                  {client.contact_email}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Badge 
                variant={client.is_active ? "default" : "secondary"}
                className="text-xs"
              >
                {client.is_active ? "Active" : "Inactive"}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedParent(client.client_id);
                      setIsAddDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Child
                  </DropdownMenuItem>
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
            </div>
          </div>

          {/* Render Children */}
          {clientHasChildren && isExpanded && (
            <div>
              {renderClientTree(client.client_id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Handle create child client
  const handleCreateChild = async (formData: any) => {
    try {
      const response = await fetch(`http://localhost:3003/api/v1/hierarchy/clients/${selectedParent}/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Child client created successfully"
        });
        setIsAddDialogOpen(false);
        fetchClientHierarchy(); // Refresh the hierarchy
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create child client',
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Client Hierarchy Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading client hierarchy...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Client Hierarchy Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h3 className="font-semibold text-destructive mb-2">Error Loading Hierarchy</h3>
            <p className="text-destructive/80">{error}</p>
            <Button 
              onClick={fetchClientHierarchy}
              className="mt-3"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Client Hierarchy Management</span>
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedParent(1)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Create a new client in the hierarchy
                  {selectedParent && (
                    <span className="block mt-1 text-sm">
                      Parent: {clients.find(c => c.client_id === selectedParent)?.display_name}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <AddClientForm 
                onSubmit={handleCreateChild}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Hierarchy Tree */}
          <div className="border rounded-lg">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Client Hierarchy Tree</h3>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {clients.length > 0 ? (
                renderClientTree(null, 0)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No clients found
                </div>
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">
                {clients.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Clients</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">
                {Math.max(...clients.map(c => c.hierarchy_level)) + 1}
              </div>
              <div className="text-sm text-muted-foreground">Hierarchy Levels</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">
                {clients.filter(c => !c.is_leaf_node).length}
              </div>
              <div className="text-sm text-muted-foreground">Parent Clients</div>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">
                {clients.filter(c => c.is_leaf_node).length}
              </div>
              <div className="text-sm text-muted-foreground">Leaf Clients</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Add Client Form Component
interface AddClientFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const AddClientForm = ({ onSubmit, onCancel }: AddClientFormProps) => {
  const [formData, setFormData] = useState({
    client_name: '',
    display_name: '',
    contact_email: '',
    client_type: 'client',
    display_order: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="client_name">Client Name (Internal)</Label>
          <Input
            id="client_name"
            value={formData.client_name}
            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
            placeholder="e.g., client_branch_1"
            required
          />
        </div>
        <div>
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g., Client Branch 1"
            required
          />
        </div>
        <div>
          <Label htmlFor="contact_email">Contact Email</Label>
          <Input
            id="contact_email"
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            placeholder="contact@client.com"
          />
        </div>
        <div>
          <Label htmlFor="client_type">Client Type</Label>
          <Select
            value={formData.client_type}
            onValueChange={(value) => setFormData({ ...formData, client_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="division">Division</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex space-x-2 pt-4">
        <Button type="submit">Create Client</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};