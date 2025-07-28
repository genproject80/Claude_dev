import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Settings, Plus, Save, Shield, Eye, RotateCcw, Edit, Trash2, Users } from 'lucide-react';
import { adminApi } from '@/services/api';

interface Dashboard {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  route_path?: string;
  is_active: boolean;
}

interface RolePermission {
  id: number;
  role_name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  permission_count: number;
  permissions: Record<string, {
    dashboard_id: number;
    dashboard_name: string;
    dashboard_display_name: string;
    can_access: boolean;
  }>;
}

interface NewRole {
  name: string;
  display_name: string;
  description: string;
}

interface EditRole {
  display_name: string;
  description: string;
  is_active: boolean;
}

interface NewDashboard {
  name: string;
  display_name: string;
  description: string;
  route_path: string;
}

const RoleManagement = () => {
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  
  // Role creation form
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<NewRole>({
    name: '',
    display_name: '',
    description: ''
  });
  
  // Role editing form
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<EditRole>({
    display_name: '',
    description: '',
    is_active: true
  });
  
  // Role deletion confirmation
  const [deleteRoleOpen, setDeleteRoleOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);
  
  // New dashboard form
  const [newDashboardOpen, setNewDashboardOpen] = useState(false);
  const [newDashboard, setNewDashboard] = useState<NewDashboard>({
    name: '',
    display_name: '',
    description: '',
    route_path: ''
  });

  const fetchRolesAndPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminApi.getRoles();
      if (response.success) {
        setRoles(response.data.roles);
        setDashboards(response.data.dashboards);
      } else {
        setError('Failed to load roles and permissions');
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  const handlePermissionChange = (roleName: string, dashboardName: string, canAccess: boolean) => {
    setRoles(prevRoles => 
      prevRoles.map(role => {
        if (role.role_name === roleName) {
          // Find the dashboard to get its ID
          const dashboard = dashboards.find(d => d.name === dashboardName);
          if (!dashboard) {
            console.error('Dashboard not found:', dashboardName, 'Available dashboards:', dashboards);
            return role;
          }

          return {
            ...role,
            permissions: {
              ...role.permissions,
              [dashboardName]: {
                dashboard_id: dashboard.id,
                dashboard_name: dashboardName,
                dashboard_display_name: dashboard.display_name,
                ...role.permissions[dashboardName], // Preserve existing data if any
                can_access: canAccess
              }
            }
          };
        }
        return role;
      })
    );

    // Mark this role as having pending changes
    setPendingChanges(prev => ({ ...prev, [roleName]: true }));
  };

  const saveRolePermissions = async (roleName: string) => {
    try {
      setSaving(roleName);
      setError(null);

      const role = roles.find(r => r.role_name === roleName);
      if (!role) return;

      // Convert permissions to the format expected by the API
      const permissions = Object.values(role.permissions).map(perm => ({
        dashboard_id: perm.dashboard_id,
        can_access: perm.can_access
      }));

      const response = await adminApi.updateRolePermissions(roleName, permissions);
      
      if (response.success) {
        // Clear pending changes for this role
        setPendingChanges(prev => ({ ...prev, [roleName]: false }));
      } else {
        setError(`Failed to update permissions for ${roleName}`);
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(`Failed to update permissions for ${roleName}`);
    } finally {
      setSaving(null);
    }
  };

  const createRole = async () => {
    try {
      setError(null);
      
      if (!newRole.name || !newRole.display_name) {
        setError('Name and display name are required');
        return;
      }

      // Validate role name format
      if (!/^[a-zA-Z0-9_]+$/.test(newRole.name)) {
        setError('Role name can only contain letters, numbers, and underscores');
        return;
      }

      const response = await adminApi.createRole({
        name: newRole.name,
        display_name: newRole.display_name,
        description: newRole.description || undefined
      });

      if (response.success) {
        setNewRoleOpen(false);
        setNewRole({ name: '', display_name: '', description: '' });
        // Refresh the data to include the new role
        await fetchRolesAndPermissions();
      } else {
        setError('Failed to create role');
      }
    } catch (err) {
      console.error('Error creating role:', err);
      setError('Failed to create role');
    }
  };

  const openEditRole = (roleName: string) => {
    const role = roles.find(r => r.role_name === roleName);
    if (role) {
      setEditingRole(roleName);
      setEditRole({
        display_name: role.display_name,
        description: role.description || '',
        is_active: role.is_active
      });
      setEditRoleOpen(true);
    }
  };

  const updateRole = async () => {
    if (!editingRole) return;

    try {
      setError(null);

      if (!editRole.display_name) {
        setError('Display name is required');
        return;
      }

      const response = await adminApi.updateRole(editingRole, {
        display_name: editRole.display_name,
        description: editRole.description || undefined,
        is_active: editRole.is_active
      });

      if (response.success) {
        setEditRoleOpen(false);
        setEditingRole(null);
        setEditRole({ display_name: '', description: '', is_active: true });
        // Refresh the data
        await fetchRolesAndPermissions();
      } else {
        setError('Failed to update role');
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role');
    }
  };

  const openDeleteRole = (roleName: string) => {
    setDeletingRole(roleName);
    setDeleteRoleOpen(true);
  };

  const deleteRole = async () => {
    if (!deletingRole) return;

    try {
      setError(null);

      const response = await adminApi.deleteRole(deletingRole);

      if (response.success) {
        setDeleteRoleOpen(false);
        setDeletingRole(null);
        // Refresh the data
        await fetchRolesAndPermissions();
      } else {
        setError('Failed to delete role');
      }
    } catch (err: any) {
      console.error('Error deleting role:', err);
      setError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const createDashboard = async () => {
    try {
      setError(null);
      
      if (!newDashboard.name || !newDashboard.display_name) {
        setError('Name and display name are required');
        return;
      }

      const response = await adminApi.createDashboard({
        name: newDashboard.name,
        display_name: newDashboard.display_name,
        description: newDashboard.description || undefined,
        route_path: newDashboard.route_path || undefined
      });

      if (response.success) {
        setNewDashboardOpen(false);
        setNewDashboard({ name: '', display_name: '', description: '', route_path: '' });
        // Refresh the data to include the new dashboard
        await fetchRolesAndPermissions();
      } else {
        setError('Failed to create dashboard');
      }
    } catch (err) {
      console.error('Error creating dashboard:', err);
      setError('Failed to create dashboard');
    }
  };

  const resetChanges = () => {
    setPendingChanges({});
    fetchRolesAndPermissions();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading role management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Role Management</h2>
          <p className="text-muted-foreground">
            Manage user roles and dashboard permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={resetChanges} 
            variant="outline"
            disabled={Object.values(pendingChanges).every(changed => !changed)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Changes
          </Button>
          <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Create a new user role with custom permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    placeholder="e.g., data_analyst"
                    value={newRole.name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only letters, numbers, and underscores allowed. Will be converted to lowercase.
                  </p>
                </div>
                <div>
                  <Label htmlFor="role-display-name">Display Name</Label>
                  <Input
                    id="role-display-name"
                    placeholder="e.g., Data Analyst"
                    value={newRole.display_name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    placeholder="Optional description of this role's purpose"
                    value={newRole.description}
                    onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewRoleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createRole}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={newDashboardOpen} onOpenChange={setNewDashboardOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Dashboard</DialogTitle>
                <DialogDescription>
                  Add a new dashboard that can be assigned to user roles.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., analytics_dashboard"
                    value={newDashboard.name}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    placeholder="e.g., Analytics Dashboard"
                    value={newDashboard.display_name}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description of this dashboard"
                    value={newDashboard.description}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="route_path">Route Path</Label>
                  <Input
                    id="route_path"
                    placeholder="e.g., /analytics"
                    value={newDashboard.route_path}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, route_path: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewDashboardOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createDashboard}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Dashboard
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert className="border-destructive/50 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">
              User role configurations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Dashboards</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboards.length}</div>
            <p className="text-xs text-muted-foreground">
              Active dashboard modules
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Changes</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(pendingChanges).filter(Boolean).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Unsaved permission changes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Configure which dashboards each role can access. Changes are saved per role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Role</TableHead>
                  {dashboards.map(dashboard => (
                    <TableHead key={dashboard.id} className="text-center">
                      <div className="space-y-1">
                        <div className="font-semibold">{dashboard.display_name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {dashboard.name}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.role_name}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            role.is_system_role ? 'destructive' : 'default'
                          }>
                            {role.display_name}
                          </Badge>
                          {role.is_system_role && (
                            <Badge variant="outline" className="text-xs">
                              System
                            </Badge>
                          )}
                          {pendingChanges[role.role_name] && (
                            <Badge variant="outline" className="text-orange-600">
                              Modified
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {role.role_name} • {role.user_count} user{role.user_count !== 1 ? 's' : ''}
                        </div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {dashboards.map(dashboard => {
                      const permission = role.permissions[dashboard.name];
                      const hasPermission = permission?.can_access || false;
                      
                      return (
                        <TableCell key={dashboard.id} className="text-center">
                          <Switch
                            checked={hasPermission}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(role.role_name, dashboard.name, checked)
                            }
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => saveRolePermissions(role.role_name)}
                          disabled={!pendingChanges[role.role_name] || saving === role.role_name}
                          className="flex-1"
                        >
                          {saving === role.role_name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditRole(role.role_name)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!role.is_system_role && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDeleteRole(role.role_name)}
                            disabled={role.user_count > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Information */}
      <Card>
        <CardHeader>
          <CardTitle>Available Dashboards</CardTitle>
          <CardDescription>
            Information about all available dashboard modules in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {dashboards.map(dashboard => (
              <div key={dashboard.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{dashboard.display_name}</h4>
                  <Badge variant={dashboard.is_active ? "default" : "secondary"}>
                    {dashboard.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Name:</strong> {dashboard.name}
                </p>
                {dashboard.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Description:</strong> {dashboard.description}
                  </p>
                )}
                {dashboard.route_path && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Route:</strong> {dashboard.route_path}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-display-name">Display Name</Label>
              <Input
                id="edit-display-name"
                value={editRole.display_name}
                onChange={(e) => setEditRole(prev => ({ ...prev, display_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editRole.description}
                onChange={(e) => setEditRole(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is-active"
                checked={editRole.is_active}
                onCheckedChange={(checked) => setEditRole(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="edit-is-active">Role is active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditRoleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateRole}>
                <Save className="h-4 w-4 mr-2" />
                Update Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deletingRole}"? This action cannot be undone.
              {(() => {
                const role = roles.find(r => r.role_name === deletingRole);
                if (role?.user_count && role.user_count > 0) {
                  return (
                    <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                      <p className="text-destructive text-sm">
                        <strong>Cannot delete:</strong> This role has {role.user_count} active user{role.user_count !== 1 ? 's' : ''}. 
                        Please reassign these users to other roles before deleting.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={(() => {
                const role = roles.find(r => r.role_name === deletingRole);
                return role?.user_count && role.user_count > 0;
              })()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleManagement;