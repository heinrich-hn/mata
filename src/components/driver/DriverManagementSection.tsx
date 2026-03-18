import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AssignVehicleDialog from '@/components/driver/AssignVehicleDialog';
import { CreateDriverAuthDialog } from '@/components/driver/CreateDriverAuthDialog';
import DriverDocumentsSection from '@/components/driver/DriverDocumentsSection';
import { useDriverAuth } from '@/hooks/useDriverAuth';
import { useDrivers, type Driver, type DriverInsert } from '@/hooks/useDrivers';
import { Calendar, Edit, Eye, FileText, Loader2, Mail, MoreVertical, Phone, Plus, Search, Smartphone, SmartphoneCharging, Trash2, Truck, Unlink, User } from 'lucide-react';
import { useState } from 'react';

const INITIAL_FORM_STATE: Partial<DriverInsert> = {
  first_name: '',
  last_name: '',
  driver_number: '',
  license_number: '',
  license_class: '',
  license_expiry: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  hire_date: '',
  status: 'active',
  notes: '',
};

const DriverManagementSection = () => {
  const {
    drivers,
    isLoading,
    createDriver,
    updateDriver,
    deleteDriver,
    isCreating,
    isUpdating,
    isDeleting,
    getDriverFullName,
    refetch,
  } = useDrivers();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<Partial<DriverInsert>>(INITIAL_FORM_STATE);

  // Auth profile state
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [selectedDriverForAuth, setSelectedDriverForAuth] = useState<Driver | null>(null);

  // Driver detail/documents state
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDriverForDetail, setSelectedDriverForDetail] = useState<Driver | null>(null);

  // Vehicle assignment state
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [selectedDriverForVehicle, setSelectedDriverForVehicle] = useState<Driver | null>(null);

  // Unlink mobile profile state
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [driverToUnlink, setDriverToUnlink] = useState<Driver | null>(null);
  const { unlinkAuthProfile, isUnlinkingProfile } = useDriverAuth();

  // Generate next driver number
  const generateDriverNumber = (): string => {
    if (drivers.length === 0) return 'DRV-0001';

    const numbers = drivers
      .map(d => {
        const match = d.driver_number.match(/DRV-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));

    const maxNum = Math.max(...numbers, 0);
    return `DRV-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Filter drivers
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = searchQuery === '' ||
      getDriverFullName(driver).toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.driver_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.license_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle form input changes
  const handleInputChange = (field: keyof DriverInsert, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Open create dialog
  const handleOpenCreate = () => {
    setEditingDriver(null);
    setFormData({
      ...INITIAL_FORM_STATE,
      driver_number: generateDriverNumber(),
    });
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      first_name: driver.first_name,
      last_name: driver.last_name,
      driver_number: driver.driver_number,
      license_number: driver.license_number,
      license_class: driver.license_class || '',
      license_expiry: driver.license_expiry || '',
      phone: driver.phone || '',
      email: driver.email || '',
      address: driver.address || '',
      city: driver.city || '',
      state: driver.state || '',
      zip_code: driver.zip_code || '',
      emergency_contact_name: driver.emergency_contact_name || '',
      emergency_contact_phone: driver.emergency_contact_phone || '',
      hire_date: driver.hire_date || '',
      status: driver.status,
      notes: driver.notes || '',
    });
    setIsDialogOpen(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.driver_number || !formData.license_number) {
      return;
    }

    try {
      if (editingDriver) {
        const previousName = `${editingDriver.first_name} ${editingDriver.last_name}`.trim();
        await updateDriver({
          id: editingDriver.id,
          updates: formData,
          previousName,
        });
      } else {
        await createDriver(formData as DriverInsert);
      }
      setIsDialogOpen(false);
      setFormData(INITIAL_FORM_STATE);
      setEditingDriver(null);
    } catch {
      // Error handled by hook
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingDriver) return;

    try {
      await deleteDriver(deletingDriver.id);
      setIsDeleteDialogOpen(false);
      setDeletingDriver(null);
    } catch {
      // Error handled by hook
    }
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'terminated':
        return <Badge variant="outline" className="text-destructive border-destructive">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  // Check if license is expiring soon (within 30 days) or expired
  const getLicenseStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive" className="ml-2">Expired</Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">Expiring Soon</Badge>;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Driver Registry
            </CardTitle>
            <CardDescription>
              Manage drivers that can be assigned to trips, loads, and vehicles
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
                <DialogDescription>
                  {editingDriver
                    ? 'Update driver information below.'
                    : 'Enter driver details. They will be available in all driver selection fields.'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver_number">Driver Number *</Label>
                    <Input
                      id="driver_number"
                      value={formData.driver_number || ''}
                      onChange={(e) => handleInputChange('driver_number', e.target.value)}
                      placeholder="DRV-0001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name || ''}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name || ''}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {/* License Info */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="license_number">License Number *</Label>
                    <Input
                      id="license_number"
                      value={formData.license_number || ''}
                      onChange={(e) => handleInputChange('license_number', e.target.value)}
                      placeholder="DL123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_class">License Class</Label>
                    <Select
                      value={formData.license_class || ''}
                      onValueChange={(value) => handleInputChange('license_class', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Motorcycle</SelectItem>
                        <SelectItem value="B">B - Light Motor Vehicle</SelectItem>
                        <SelectItem value="C">C - Heavy Motor Vehicle</SelectItem>
                        <SelectItem value="C1">C1 - Heavy Motor Vehicle (3.5-16t)</SelectItem>
                        <SelectItem value="EC">EC - Extra Heavy (Articulated)</SelectItem>
                        <SelectItem value="EC1">EC1 - Extra Heavy (Rigid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_expiry">License Expiry</Label>
                    <Input
                      id="license_expiry"
                      type="date"
                      value={formData.license_expiry || ''}
                      onChange={(e) => handleInputChange('license_expiry', e.target.value)}
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+27 82 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="john.doe@example.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Johannesburg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Province/State</Label>
                    <Input
                      id="state"
                      value={formData.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="Gauteng"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">Postal Code</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code || ''}
                      onChange={(e) => handleInputChange('zip_code', e.target.value)}
                      placeholder="2000"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name || ''}
                      onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                    <Input
                      id="emergency_contact_phone"
                      type="tel"
                      value={formData.emergency_contact_phone || ''}
                      onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                      placeholder="+27 82 987 6543"
                    />
                  </div>
                </div>

                {/* Employment */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Hire Date</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={formData.hire_date || ''}
                      onChange={(e) => handleInputChange('hire_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status || 'active'}
                      onValueChange={(value) => handleInputChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about this driver..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isCreating || isUpdating || !formData.first_name || !formData.last_name || !formData.license_number}
                >
                  {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingDriver ? 'Save Changes' : 'Create Driver'}
                </Button>
              </DialogFooter>

              {/* Show documents section when editing an existing driver */}
              {editingDriver && (
                <div className="border-t pt-4 mt-2">
                  <DriverDocumentsSection
                    driverId={editingDriver.id}
                    driverName={getDriverFullName(editingDriver)}
                    compact
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, license, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{drivers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {drivers.filter(d => d.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive/Suspended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {drivers.filter(d => d.status === 'inactive' || d.status === 'suspended').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Expiring</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {drivers.filter(d => {
                  if (!d.license_expiry) return false;
                  const expiry = new Date(d.license_expiry);
                  const today = new Date();
                  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return daysUntilExpiry <= 30;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No drivers found</p>
            <p className="text-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first driver to get started'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead className="text-center">Mobile App</TableHead>
                  <TableHead className="text-center">Vehicle</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{getDriverFullName(driver)}</p>
                          <p className="text-sm text-muted-foreground">{driver.driver_number}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">{driver.license_number}</p>
                        <div className="flex items-center">
                          <span className="text-sm text-muted-foreground">
                            {driver.license_class || 'N/A'} • Exp: {formatDate(driver.license_expiry)}
                          </span>
                          {getLicenseStatus(driver.license_expiry)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {driver.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {driver.phone}
                          </div>
                        )}
                        {driver.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {driver.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(driver.hire_date)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(driver.status)}</TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedDriverForDetail(driver);
                                setIsDetailDialogOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Documents & Certificates</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {driver.auth_user_id ? (
                              <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30">
                                <SmartphoneCharging className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {driver.auth_user_id
                              ? 'Has mobile app access'
                              : 'No mobile app profile'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedDriverForVehicle(driver);
                                setIsVehicleDialogOpen(true);
                              }}
                              disabled={!driver.auth_user_id}
                            >
                              <Truck className={`h-4 w-4 ${driver.auth_user_id ? 'text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {driver.auth_user_id
                              ? 'Assign vehicle'
                              : 'Create mobile profile first'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(driver)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDriverForDetail(driver);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Documents
                          </DropdownMenuItem>
                          {!driver.auth_user_id && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDriverForAuth(driver);
                                setIsAuthDialogOpen(true);
                              }}
                            >
                              <Smartphone className="h-4 w-4 mr-2" />
                              Create Mobile Profile
                            </DropdownMenuItem>
                          )}
                          {driver.auth_user_id && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDriverForVehicle(driver);
                                setIsVehicleDialogOpen(true);
                              }}
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Assign Vehicle
                            </DropdownMenuItem>
                          )}
                          {driver.auth_user_id && (
                            <DropdownMenuItem
                              onClick={() => {
                                setDriverToUnlink(driver);
                                setIsUnlinkDialogOpen(true);
                              }}
                              className="text-orange-600"
                            >
                              <Unlink className="h-4 w-4 mr-2" />
                              Unlink Mobile Profile
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingDriver(driver);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
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
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Driver</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deletingDriver ? getDriverFullName(deletingDriver) : ''}?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Mobile Auth Profile Dialog */}
        <CreateDriverAuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setIsAuthDialogOpen}
          driver={selectedDriverForAuth}
          onSuccess={() => {
            refetch();
          }}
        />

        {/* Driver Documents Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedDriverForDetail ? getDriverFullName(selectedDriverForDetail) : ''} — Documents
              </DialogTitle>
              <DialogDescription>
                Manage document uploads and expiry dates for licenses, PDP, passport, medicals, retest, and defensive driving.
              </DialogDescription>
            </DialogHeader>

            {selectedDriverForDetail && (
              <div className="py-2">
                {/* Driver summary */}
                <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{getDriverFullName(selectedDriverForDetail)}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{selectedDriverForDetail.driver_number}</span>
                      <span>•</span>
                      <span>License: {selectedDriverForDetail.license_number}</span>
                      {selectedDriverForDetail.phone && (
                        <><span>•</span><span>{selectedDriverForDetail.phone}</span></>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(selectedDriverForDetail.status)}
                </div>

                <DriverDocumentsSection
                  driverId={selectedDriverForDetail.id}
                  driverName={getDriverFullName(selectedDriverForDetail)}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Assign Vehicle Dialog */}
        <AssignVehicleDialog
          open={isVehicleDialogOpen}
          onOpenChange={setIsVehicleDialogOpen}
          driver={selectedDriverForVehicle}
        />

        {/* Unlink Mobile Profile Confirmation Dialog */}
        <Dialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Unlink className="h-5 w-5 text-orange-600" />
                Unlink Mobile Profile
              </DialogTitle>
              <DialogDescription>
                This will unlink the mobile app profile for{' '}
                <strong>{driverToUnlink ? getDriverFullName(driverToUnlink) : ''}</strong>.
                Their vehicle assignments will be deactivated and they won&apos;t be able to log in to the mobile app until you create a new profile.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUnlinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!driverToUnlink?.auth_user_id) return;
                  await unlinkAuthProfile({
                    driverId: driverToUnlink.id,
                    authUserId: driverToUnlink.auth_user_id,
                  });
                  setIsUnlinkDialogOpen(false);
                  setDriverToUnlink(null);
                  refetch();
                }}
                disabled={isUnlinkingProfile}
              >
                {isUnlinkingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Unlink Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DriverManagementSection;
