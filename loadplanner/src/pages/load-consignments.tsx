import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLoadConsignment, useDeleteLoadConsignment, useLoadConsignments, useUpdateLoadConsignment, type LoadConsignmentInsert } from '@/hooks/useLoadConsignments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useLoads } from '@/hooks/useTrips';
import { exportLoadConsignmentsToPdf } from '@/lib/exportLoadConsignmentsToPdf';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  Building2,
  CheckCircle,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const consignmentSchema = z.object({
  source_load_id: z.string().optional(),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_reference: z.string().optional(),

  // Load details
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  cargo_type: z.string().optional(),
  quantity: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  loading_date: z.string().optional(),
  offloading_date: z.string().optional(),

  // Financials
  agreed_rate: z.number().min(0).optional(),
  rate_currency: z.string().default('USD'),
  rate_type: z.enum(['per_load', 'per_km', 'per_ton']).optional(),
  total_distance_km: z.number().min(0).optional(),
  total_amount: z.number().min(0).optional(),

  // Supplier vehicle
  supplier_vehicle_id: z.string().optional(),
  supplier_vehicle_reg: z.string().optional(),
  supplier_driver_name: z.string().optional(),
  supplier_driver_phone: z.string().optional(),
  supplier_driver_license: z.string().optional(),

  notes: z.string().optional(),
});

type ConsignmentFormData = z.infer<typeof consignmentSchema>;

// Helper function to convert undefined to null
const toNull = <T,>(value: T | undefined): T | null => {
  return value === undefined ? null : value;
};

// Get current user ID (you'll need to implement this based on your auth system)
const getCurrentUserId = (): string | null => {
  // Replace this with your actual auth logic
  return null;
};

export default function LoadConsignmentsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: consignments = [], isLoading } = useLoadConsignments();
  const { data: suppliers = [] } = useSuppliers();
  const { data: loads = [] } = useLoads();
  const createConsignment = useCreateLoadConsignment();
  const updateConsignment = useUpdateLoadConsignment();
  const deleteConsignment = useDeleteLoadConsignment();

  const form = useForm<ConsignmentFormData>({
    resolver: zodResolver(consignmentSchema),
    defaultValues: {
      source_load_id: 'none',
      supplier_id: '',
      supplier_reference: '',
      origin: '',
      destination: '',
      cargo_type: '',
      quantity: undefined,
      weight: undefined,
      loading_date: '',
      offloading_date: '',
      agreed_rate: undefined,
      rate_currency: 'USD',
      rate_type: 'per_load',
      total_distance_km: undefined,
      total_amount: undefined,
      supplier_vehicle_id: '',
      supplier_vehicle_reg: '',
      supplier_driver_name: '',
      supplier_driver_phone: '',
      supplier_driver_license: '',
      notes: '',
    },
  });

  const handleSubmit = (data: ConsignmentFormData) => {
    const selectedSupplier = suppliers.find(s => s.id === data.supplier_id);

    const consignmentData: LoadConsignmentInsert = {
      // Convert 'none' to null for source_load_id
      source_load_id: data.source_load_id === 'none' ? null : data.source_load_id || null,

      // Required fields
      supplier_id: data.supplier_id,
      supplier_name: selectedSupplier?.name || '',

      // Optional fields - convert undefined to null
      supplier_reference: toNull(data.supplier_reference),

      // Load details
      origin: data.origin,
      destination: data.destination,
      cargo_type: toNull(data.cargo_type),
      quantity: toNull(data.quantity),
      weight: toNull(data.weight),
      loading_date: toNull(data.loading_date),
      offloading_date: toNull(data.offloading_date),

      // Financials
      agreed_rate: toNull(data.agreed_rate),
      rate_currency: data.rate_currency,
      rate_type: toNull(data.rate_type),
      total_distance_km: toNull(data.total_distance_km),
      total_amount: toNull(data.total_amount),

      // Supplier vehicle - including driver license
      supplier_vehicle_id: toNull(data.supplier_vehicle_id),
      supplier_vehicle_reg: toNull(data.supplier_vehicle_reg),
      supplier_driver_name: toNull(data.supplier_driver_name),
      supplier_driver_phone: toNull(data.supplier_driver_phone),
      supplier_driver_license: toNull(data.supplier_driver_license),

      // Default values for array fields
      special_handling: [],

      // Default values for required fields that aren't in the form
      status: 'pending',
      pod_received: false,
      pod_url: null,
      invoice_received: false,
      invoice_number: null,
      invoice_amount: null,
      invoice_date: null,
      payment_due_date: null,
      payment_status: 'unpaid',
      payment_date: null,
      assigned_at: null,
      picked_up_at: null,
      delivered_at: null,
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,

      // Optional notes
      notes: toNull(data.notes),

      // Created by
      created_by: getCurrentUserId(),
    };

    createConsignment.mutate(consignmentData, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        form.reset();
      },
    });
  };

  const filteredConsignments = consignments.filter(c => {
    if (activeTab !== 'all' && c.status !== activeTab) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.consignment_number.toLowerCase().includes(query) ||
        c.origin.toLowerCase().includes(query) ||
        c.destination.toLowerCase().includes(query) ||
        c.supplier_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-600">Pending</Badge>;
      case 'assigned':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Assigned</Badge>;
      case 'in-transit':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600">In Transit</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Delivered</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-600">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/10 text-emerald-600">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500/10 text-amber-600">Partial</Badge>;
      case 'unpaid':
        return <Badge className="bg-rose-500/10 text-rose-600">Unpaid</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Load Consignments</h1>
            <p className="text-muted-foreground">
              Manage outsourced loads and external supplier deliveries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                exportLoadConsignmentsToPdf(consignments, {
                  status: activeTab !== 'all' ? activeTab : undefined,
                  searchQuery: searchQuery
                });
              }}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <Plus className="h-4 w-4" />
                  New Consignment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    Create Load Consignment
                  </DialogTitle>
                  <DialogDescription>
                    Outsource a load to an external supplier
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    {/* Supplier Selection */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Supplier Information</h4>
                      <FormField
                        control={form.control}
                        name="supplier_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliers.filter(s => s.status === 'active').map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="supplier_reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier Reference</FormLabel>
                            <FormControl>
                              <Input placeholder="Supplier's reference number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Load Details */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Load Details</h4>
                      <FormField
                        control={form.control}
                        name="source_load_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source Load (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select internal load" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No source load</SelectItem>
                                {loads.map((load) => (
                                  <SelectItem key={load.id} value={load.id}>
                                    {load.load_id} - {load.origin} → {load.destination}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="origin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Origin *</FormLabel>
                              <FormControl>
                                <Input placeholder="Pickup location" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="destination"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Destination *</FormLabel>
                              <FormControl>
                                <Input placeholder="Delivery location" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="loading_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Loading Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="offloading_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Offloading Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="cargo_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cargo Type</FormLabel>
                              <FormControl>
                                <Input placeholder="Type of cargo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight (tons)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="0.0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Financials */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Financials</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="rate_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select rate type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="per_load">Per Load</SelectItem>
                                  <SelectItem value="per_km">Per Kilometer</SelectItem>
                                  <SelectItem value="per_ton">Per Ton</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="rate_currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Currency</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="BWP">BWP</SelectItem>
                                  <SelectItem value="ZMW">ZMW</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="agreed_rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Agreed Rate</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="total_distance_km"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Distance (km)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0.0"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="total_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Supplier Vehicle & Driver */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Supplier Vehicle & Driver</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="supplier_vehicle_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle ID</FormLabel>
                              <FormControl>
                                <Input placeholder="Vehicle number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="supplier_vehicle_reg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Registration</FormLabel>
                              <FormControl>
                                <Input placeholder="Registration number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="supplier_driver_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Driver Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Driver's full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="supplier_driver_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Driver Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="Contact number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="supplier_driver_license"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Driver License</FormLabel>
                            <FormControl>
                              <Input placeholder="Driver's license number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional information..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createConsignment.isPending} className="bg-purple-600 hover:bg-purple-700">
                        {createConsignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Consignment
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="assigned">Assigned</TabsTrigger>
              <TabsTrigger value="in-transit">In Transit</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1">
            <Input
              placeholder="Search consignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </div>

        {/* Consignments Table */}
        {filteredConsignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No consignments found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                {searchQuery || activeTab !== 'all'
                  ? 'No consignments match your current filters.'
                  : 'Create your first load consignment to outsource to external suppliers.'}
              </p>
              {!searchQuery && activeTab === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4" />
                  Create First Consignment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consignment #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsignments.map((consignment) => (
                    <TableRow key={consignment.id} className="group">
                      <TableCell>
                        <div className="font-medium">{consignment.consignment_number}</div>
                        {consignment.source_load && (
                          <div className="text-xs text-muted-foreground">
                            Source: {consignment.source_load.load_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{consignment.supplier_name || 'Unknown'}</div>
                            {consignment.supplier_reference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {consignment.supplier_reference}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">
                            {consignment.origin} → {consignment.destination}
                          </span>
                        </div>
                        {consignment.total_distance_km && (
                          <div className="text-xs text-muted-foreground">
                            {consignment.total_distance_km} km
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {consignment.loading_date && (
                          <div className="text-sm">
                            {format(new Date(consignment.loading_date), 'dd MMM')}
                            {consignment.offloading_date && (
                              <> → {format(new Date(consignment.offloading_date), 'dd MMM')}</>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(consignment.status)}
                          {consignment.pod_received && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                              POD Received
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(consignment.payment_status)}
                      </TableCell>
                      <TableCell>
                        {consignment.total_amount ? (
                          <div className="font-medium">
                            {consignment.rate_currency} {consignment.total_amount.toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            onClick={() => {
                              exportLoadConsignmentsToPdf([consignment], {
                                status: activeTab !== 'all' ? activeTab : undefined,
                                searchQuery: searchQuery
                              });
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Export Consignment PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                // Navigate to details page - implement based on your routing
                                console.log('View details for consignment:', consignment.id);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                // Handle POD upload/view
                                console.log('Handle POD for consignment:', consignment.id);
                              }}>
                                <FileText className="h-4 w-4 mr-2" />
                                POD
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                // Mark as delivered
                                updateConsignment.mutate({
                                  id: consignment.id,
                                  status: 'delivered',
                                  delivered_at: new Date().toISOString()
                                });
                              }}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Delivered
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                // Open payment recording dialog - implement based on your UI
                                console.log('Record payment for consignment:', consignment.id);
                              }}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => {
                                if (window.confirm(`Are you sure you want to delete consignment ${consignment.consignment_number}?`)) {
                                  deleteConsignment.mutate(consignment.id);
                                }
                              }}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
