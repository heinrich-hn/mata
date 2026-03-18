import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateSupplier, useDeleteSupplier, useSuppliers, useUpdateSupplier, type Supplier, type SupplierInsert } from '@/hooks/useSuppliers';
import { exportSuppliersToPdf } from '@/lib/exportSuppliersToPdf';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  Building2,
  Calendar,
  Edit,
  Eye,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters'),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().default('Zimbabwe'),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  bank_branch: z.string().optional(),
  swift_code: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  rating: z.number().min(1).max(5).optional(),
  contract_start_date: z.string().optional(),
  contract_end_date: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

// Helper function to convert undefined to null
const toNull = <T,>(value: T | undefined): T | null => {
  return value === undefined ? null : value;
};

// Get current user ID (you'll need to implement this based on your auth system)
const getCurrentUserId = (): string | null => {
  // Replace this with your actual auth logic
  // Example: return auth.currentUser?.id || null;
  return null;
};

export default function SuppliersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'Zimbabwe',
      tax_id: '',
      payment_terms: '',
      bank_name: '',
      bank_account: '',
      bank_branch: '',
      swift_code: '',
      notes: '',
      status: 'active',
      rating: undefined,
      contract_start_date: '',
      contract_end_date: '',
    },
  });

  const editForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'Zimbabwe',
      tax_id: '',
      payment_terms: '',
      bank_name: '',
      bank_account: '',
      bank_branch: '',
      swift_code: '',
      notes: '',
      status: 'active',
      rating: undefined,
      contract_start_date: '',
      contract_end_date: '',
    },
  });

  const handleCreateSubmit = (data: SupplierFormData) => {
    const supplierData: SupplierInsert = {
      name: data.name,
      contact_person: toNull(data.contact_person),
      contact_phone: toNull(data.contact_phone),
      contact_email: toNull(data.contact_email),
      address: toNull(data.address),
      city: toNull(data.city),
      state: toNull(data.state),
      zip_code: toNull(data.zip_code),
      country: data.country,
      tax_id: toNull(data.tax_id),
      payment_terms: toNull(data.payment_terms),
      bank_name: toNull(data.bank_name),
      bank_account: toNull(data.bank_account),
      bank_branch: toNull(data.bank_branch),
      swift_code: toNull(data.swift_code),
      notes: toNull(data.notes),
      status: data.status,
      rating: toNull(data.rating),
      contract_start_date: toNull(data.contract_start_date),
      contract_end_date: toNull(data.contract_end_date),
      created_by: getCurrentUserId(),
    };

    createSupplier.mutate(supplierData, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        form.reset();
      },
    });
  };

  const handleEditSubmit = (data: SupplierFormData) => {
    if (!selectedSupplier) return;

    const supplierData = {
      id: selectedSupplier.id,
      name: data.name,
      contact_person: toNull(data.contact_person),
      contact_phone: toNull(data.contact_phone),
      contact_email: toNull(data.contact_email),
      address: toNull(data.address),
      city: toNull(data.city),
      state: toNull(data.state),
      zip_code: toNull(data.zip_code),
      country: data.country,
      tax_id: toNull(data.tax_id),
      payment_terms: toNull(data.payment_terms),
      bank_name: toNull(data.bank_name),
      bank_account: toNull(data.bank_account),
      bank_branch: toNull(data.bank_branch),
      swift_code: toNull(data.swift_code),
      notes: toNull(data.notes),
      status: data.status,
      rating: toNull(data.rating),
      contract_start_date: toNull(data.contract_start_date),
      contract_end_date: toNull(data.contract_end_date),
    };

    updateSupplier.mutate(supplierData, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setSelectedSupplier(null);
        editForm.reset();
      },
    });
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    editForm.reset({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      contact_phone: supplier.contact_phone || '',
      contact_email: supplier.contact_email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      state: supplier.state || '',
      zip_code: supplier.zip_code || '',
      country: supplier.country || 'Zimbabwe',
      tax_id: supplier.tax_id || '',
      payment_terms: supplier.payment_terms || '',
      bank_name: supplier.bank_name || '',
      bank_account: supplier.bank_account || '',
      bank_branch: supplier.bank_branch || '',
      swift_code: supplier.swift_code || '',
      notes: supplier.notes || '',
      status: supplier.status,
      rating: supplier.rating || undefined,
      contract_start_date: supplier.contract_start_date || '',
      contract_end_date: supplier.contract_end_date || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      deleteSupplier.mutate(id);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.contact_person?.toLowerCase().includes(query) ||
        supplier.contact_email?.toLowerCase().includes(query) ||
        supplier.supplier_number.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Suspended</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header with buttons only */}
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                exportSuppliersToPdf(suppliers, {
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
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Add New Supplier
                  </DialogTitle>
                  <DialogDescription>
                    Register a new transport supplier or contractor
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Basic Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., ABC Transport" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
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
                          name="contact_person"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person</FormLabel>
                              <FormControl>
                                <Input placeholder="Primary contact name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="rating"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rating (1-5)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="5"
                                  placeholder="4"
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

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="contact_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="+263..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="contact_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="contact@company.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="tax_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID / VAT Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Tax registration number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Address</h4>
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Street address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="City" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State/Province</FormLabel>
                              <FormControl>
                                <Input placeholder="State" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="zip_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP/Postal Code</FormLabel>
                              <FormControl>
                                <Input placeholder="ZIP code" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input placeholder="Country" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Contract Information */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Contract Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="contract_start_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contract Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="contract_end_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contract End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="payment_terms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Terms</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Net 30, 50% upfront" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Banking Information */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider">Banking Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="bank_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bank Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Bank name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bank_branch"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Branch</FormLabel>
                              <FormControl>
                                <Input placeholder="Branch name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="bank_account"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Account number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="swift_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SWIFT Code</FormLabel>
                              <FormControl>
                                <Input placeholder="SWIFT code" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
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
                              placeholder="Any additional information about this supplier..."
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
                      <Button type="submit" disabled={createSupplier.isPending} className="bg-purple-600 hover:bg-purple-700">
                        {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Supplier
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Edit Supplier
              </DialogTitle>
              <DialogDescription>
                Update supplier information
              </DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., ABC Transport" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="contact_person"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="Primary contact name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating (1-5)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              placeholder="4"
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+263..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contact@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID / VAT Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Tax registration number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider">Address</h4>
                  <FormField
                    control={editForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="zip_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP/Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="ZIP code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contract Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider">Contract Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="contract_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="contract_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={editForm.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Net 30, 50% upfront" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Banking Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider">Banking Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Bank name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="bank_branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <Input placeholder="Branch name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="bank_account"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Account number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="swift_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SWIFT Code</FormLabel>
                          <FormControl>
                            <Input placeholder="SWIFT code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes */}
                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional information about this supplier..."
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
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateSupplier.isPending} className="bg-purple-600 hover:bg-purple-700">
                    {updateSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Supplier
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Suppliers List */}
        {filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No suppliers found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                {searchQuery
                  ? 'No suppliers match your current filters. Try adjusting your search.'
                  : 'Get started by adding your first transport supplier.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Supplier
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex items-center gap-6 p-6 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                {/* Icon + Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 rounded-lg bg-primary/10 flex-shrink-0">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      {getInitials(supplier.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{supplier.name}</div>
                      {getStatusBadge(supplier.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {supplier.supplier_number}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {supplier.contact_person && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {supplier.contact_person}
                        </div>
                      )}
                      {supplier.contact_phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {supplier.contact_phone}
                        </div>
                      )}
                      {supplier.contact_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">
                            {supplier.contact_email}
                          </span>
                        </div>
                      )}
                      {supplier.city && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {[supplier.city, supplier.state, supplier.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating & Contract */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  {supplier.rating && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3.5 w-3.5",
                            i < supplier.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {(supplier.contract_start_date || supplier.payment_terms) && (
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {supplier.contract_start_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(supplier.contract_start_date), 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Consignments
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FileText className="h-4 w-4 mr-2" />
                        View Contracts
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}