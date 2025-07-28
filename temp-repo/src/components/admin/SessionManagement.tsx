import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Trash2, Users, Activity, Clock, Monitor, ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { adminApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface Session {
  session_id: string;
  user_id: string;
  session_token: string;
  created_at: string;
  expires_at: string;
  last_activity: string;
  is_active: number;
  user_name: string;
  email: string;
  roles: string;
  client_id?: number;
}

interface SessionStats {
  active_sessions: number;
  sessions_24h: number;
  sessions_7d: number;
  active_users: number;
  total_users_with_sessions: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type FilterType = 'active' | 'recent' | 'all' | 'custom';

export const SessionManagement = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('active');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<{from?: Date; to?: Date}>({});
  const [tempDateRange, setTempDateRange] = useState<{from?: Date; to?: Date}>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const fetchSessions = async (page = currentPage, filter = currentFilter, search = debouncedSearch, customDateRange = dateRange) => {
    try {
      setLoading(true);
      
      let apiParams: any = { page, limit: 20, filter, search };
      
      // Add date range for custom filter
      if (filter === 'custom' && customDateRange?.from && customDateRange?.to) {
        // Set start date to beginning of day (00:00:00) in local timezone
        const startDate = new Date(customDateRange.from);
        startDate.setHours(0, 0, 0, 0);
        
        // Set end date to end of day (23:59:59) in local timezone
        const endDate = new Date(customDateRange.to);
        endDate.setHours(23, 59, 59, 999);
        
        apiParams.startDate = startDate.toISOString();
        apiParams.endDate = endDate.toISOString();
        console.log('Date range debug:', {
          originalFrom: customDateRange.from,
          originalTo: customDateRange.to,
          startDateISO: apiParams.startDate,
          endDateISO: apiParams.endDate
        });
        console.log('API params for custom filter:', apiParams);
      }
      
      // Add sorting parameters
      apiParams.sortBy = sortBy;
      apiParams.sortOrder = sortOrder;
      
      const [sessionsResponse, statsResponse] = await Promise.all([
        adminApi.getSessions(apiParams),
        adminApi.getSessionStats()
      ]);

      if (sessionsResponse.success) {
        setSessions(sessionsResponse.data);
        setPagination(sessionsResponse.pagination);
        setCurrentPage(page);
        setCurrentFilter(filter);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch session data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      setTerminatingSession(sessionId);
      const response = await adminApi.terminateSession(sessionId);

      if (response.success) {
        toast({
          title: "Success",
          description: "Session terminated successfully",
        });
        // Refresh the sessions list
        await fetchSessions(currentPage, currentFilter, debouncedSearch, dateRange);
      }
    } catch (error) {
      console.error('Error terminating session:', error);
      toast({
        title: "Error",
        description: "Failed to terminate session",
        variant: "destructive",
      });
    } finally {
      setTerminatingSession(null);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch sessions when debounced search changes
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when searching
    fetchSessions(1, currentFilter, debouncedSearch, dateRange);
  }, [debouncedSearch]);

  // Remove the auto-fetch when date range changes
  // Users will now use Apply button to apply the filter

  // Fetch sessions when sort changes
  useEffect(() => {
    setCurrentPage(1);
    fetchSessions(1, currentFilter, debouncedSearch, dateRange);
  }, [sortBy, sortOrder]);

  useEffect(() => {
    fetchSessions();
    
    // Refresh sessions every 2 minutes to reduce load
    const interval = setInterval(() => fetchSessions(currentPage, currentFilter, debouncedSearch, dateRange), 120000);
    return () => clearInterval(interval);
  }, []);

  const handleFilterChange = async (filter: FilterType) => {
    setCurrentPage(1); // Reset to first page when changing filter
    setCurrentFilter(filter);
    
    // For custom filter, only fetch if date range is already set
    if (filter === 'custom') {
      if (dateRange?.from && dateRange?.to) {
        await fetchSessions(1, filter, debouncedSearch, dateRange);
      }
      return;
    }
    
    // For other filters, fetch immediately
    await fetchSessions(1, filter, debouncedSearch, dateRange);
  };

  const handlePageChange = async (page: number) => {
    await fetchSessions(page, currentFilter, debouncedSearch, dateRange);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleDateRangeSelect = (range: {from?: Date; to?: Date} | undefined) => {
    // Handle undefined range from calendar component
    const safeRange = range || {};
    setTempDateRange(safeRange);
    if (safeRange.from && safeRange.to) {
      setIsDatePickerOpen(false);
    }
  };

  const handleApplyDateRange = () => {
    if (tempDateRange?.from && tempDateRange?.to) {
      console.log('Applying date range:', tempDateRange);
      setDateRange(tempDateRange);
      setCurrentPage(1);
      // Use 'custom' filter explicitly and pass the date range
      fetchSessions(1, 'custom', debouncedSearch, tempDateRange);
    }
  };

  const handleClearDateRange = () => {
    setDateRange({});
    setTempDateRange({});
    // Stay on custom tab but clear the data - NO automatic redirect
    if (currentFilter === 'custom') {
      // Just clear the sessions without changing filter
      setSessions([]);
      setPagination(null);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Same column, toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortOrder === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const getFilterDescription = () => {
    switch (currentFilter) {
      case 'active':
        return ' (active sessions)';
      case 'recent':
        return ' (last 24 hours)';
      case 'all':
        return ' (last 30 days)';
      case 'custom':
        if (dateRange?.from && dateRange?.to) {
          return ` (${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')})`;
        }
        return ' (custom range)';
      default:
        return '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatUserAgent = (userAgent: string) => {
    // Extract browser name from user agent
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  const getSessionDuration = (createdAt: string, expiresAt: string) => {
    const start = new Date(createdAt);
    const end = new Date(expiresAt);
    const now = new Date();
    
    // If session is expired, show duration from start to expiry
    // If active, show duration from start to now
    const endTime = end < now ? end : now;
    const diffMs = endTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active_sessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_users}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions (24h)</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sessions_24h}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions (7d)</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sessions_7d}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users_with_sessions}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Sessions</CardTitle>
          <CardDescription>
            Manage active and recent user sessions. Sessions are automatically cleaned up after 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by username, email, or user ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mt-2">
                Searching for: "{searchTerm}"
              </p>
            )}
          </div>

          {/* Filter Tabs */}
          <Tabs value={currentFilter} onValueChange={(value) => handleFilterChange(value as FilterType)} className="mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">Active Sessions</TabsTrigger>
              <TabsTrigger value="recent">Recent (24h)</TabsTrigger>
              <TabsTrigger value="all">All Sessions</TabsTrigger>
              <TabsTrigger value="custom">Custom Range</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Custom Date Range Picker */}
          {currentFilter === 'custom' && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/20">
              <Label className="text-sm font-medium mb-3 block">Select Date Range</Label>
              <div className="flex items-center space-x-4">
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !tempDateRange?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempDateRange?.from ? (
                        tempDateRange?.to ? (
                          <>
                            {format(tempDateRange.from, "LLL dd, y")} -{" "}
                            {format(tempDateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(tempDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={tempDateRange?.from}
                      selected={tempDateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex space-x-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApplyDateRange}
                    disabled={!tempDateRange?.from || !tempDateRange?.to}
                  >
                    Apply Filter
                  </Button>
                  
                  {(dateRange?.from || dateRange?.to || tempDateRange?.from || tempDateRange?.to) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearDateRange}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              
              {currentFilter === 'custom' && (!dateRange?.from || !dateRange?.to) && (
                <p className="text-sm text-muted-foreground mt-2">
                  {tempDateRange?.from && tempDateRange?.to ? (
                    <span className="text-orange-600">Date range selected. Click "Apply Filter" to view sessions.</span>
                  ) : (
                    "Please select both start and end dates, then click Apply Filter."
                  )}
                </p>
              )}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort('user_name')}
                    >
                      User
                      {getSortIcon('user_name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort('email')}
                    >
                      Email
                      {getSortIcon('email')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort('roles')}
                    >
                      Role
                      {getSortIcon('roles')}
                    </Button>
                  </TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort('created_at')}
                    >
                      Login Time
                      {getSortIcon('created_at')}
                    </Button>
                  </TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No sessions found
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">{session.user_name}</TableCell>
                      <TableCell>{session.email}</TableCell>
                      <TableCell>
                        <Badge variant={session.roles === 'admin' ? 'default' : 'secondary'}>
                          {session.roles}
                        </Badge>
                      </TableCell>
                      <TableCell>{session.client_id || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={session.is_active ? 'success' : 'secondary'}>
                          {session.is_active ? 'Active' : 'Ended'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(session.created_at)}</TableCell>
                      <TableCell>{getSessionDuration(session.created_at, session.expires_at)}</TableCell>
                      <TableCell className="font-mono text-sm">N/A</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>
                        {session.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={terminatingSession === session.session_id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Terminate Session</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to terminate this session for {session.user_name}? 
                                  The user will be logged out immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleTerminateSession(session.session_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Terminate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => fetchSessions(currentPage, currentFilter, debouncedSearch, dateRange)} variant="outline" size="sm" disabled={loading}>
                Refresh
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-muted-foreground">
              {pagination ? (
                `Showing ${sessions.length} of ${pagination.total} sessions${searchTerm ? ` matching "${searchTerm}"` : ''}${getFilterDescription()}`
              ) : (
                `Showing ${sessions.length} sessions${searchTerm ? ` matching "${searchTerm}"` : ''}${getFilterDescription()}`
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};