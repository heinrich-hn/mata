import { EditClientDialog } from '@/components/clients/EditClientDialog';
import { CreateClientDialog } from '@/components/trips/CreateClientDialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/hooks/useClients';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { useLoads } from '@/hooks/useTrips';
import * as timeWindowLib from '@/lib/timeWindow'; // Use the shared utility
import { safeFormatDate } from '@/lib/utils';
import {
  Building2,
  Eye,
  Link2,
  Loader2,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// Parse time_window to get customer ID with proper type handling using shared utility
function getCustomerIdFromLoad(timeWindow: unknown): string | null {
  const tw = timeWindowLib.parseTimeWindowOrNull(timeWindow);

  // Use type assertion to access thirdParty data since TimeWindowDataFull includes it
  const data = tw as { thirdParty?: { customerId?: string | number | null } } | null;
  const customerId = data?.thirdParty?.customerId;

  if (customerId === null || customerId === undefined) {
    return null;
  }

  // Convert numbers to strings
  return String(customerId);
}

export default function ClientsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: loads = [] } = useLoads();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();

  // Filter for third-party loads
  const thirdPartyLoads = useMemo(
    () => loads.filter((load) => load.load_id.startsWith('TP-')),
    [loads]
  );

  // Get loads count by customer with proper type safety
  const getLoadsForCustomer = (clientId: string) => {
    return thirdPartyLoads.filter((load) => {
      const customerId = getCustomerIdFromLoad(load.time_window);
      // Type-safe comparison: only compare if customerId is not null
      return customerId !== null && customerId === clientId;
    });
  };

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.contact_person?.toLowerCase().includes(query) ||
        client.contact_email?.toLowerCase().includes(query) ||
        client.contact_phone?.includes(query)
    );
  }, [clients, searchQuery]);

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedClient) return;

    deleteClient.mutate(selectedClient.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedClient(null);
        toast({
          title: 'Customer deleted',
          description: 'The customer has been successfully deleted.',
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to delete customer. Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  const copyPortalLink = (clientId: string, clientName: string) => {
    const portalUrl = `${window.location.origin}/portal/${clientId}`;
    navigator.clipboard
      .writeText(portalUrl)
      .then(() => {
        toast({
          title: 'Portal link copied!',
          description: `Share this link with ${clientName} to give them access to their portal.`,
        });
      })
      .catch(() => {
        toast({
          title: 'Failed to copy',
          description: 'Please try again or copy manually.',
          variant: 'destructive',
        });
      });
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Search + List Header */}
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {/* List / Loading / Empty */}
        {clientsLoading ? (
          <div className="rounded-xl border bg-card overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-6 p-6 border-b last:border-none"
              >
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-56" />
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-8 w-8 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-purple-500" />
            {searchQuery ? (
              <>
                <p className="font-medium">No customers found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search query
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">No customers yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first third-party customer to get started
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {filteredClients.map((client) => {
              const customerLoads = getLoadsForCustomer(client.id);
              return (
                <div
                  key={client.id}
                  className="flex items-center gap-6 p-6 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                >
                  {/* Icon + Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{client.name}</div>

                      {client.notes && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {client.notes}
                        </div>
                      )}

                      {client.contact_person && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <User className="h-3.5 w-3.5" />
                          {client.contact_person}
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {client.contact_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {client.contact_phone}
                          </div>
                        )}
                        {client.contact_email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[200px]">
                              {client.contact_email}
                            </span>
                          </div>
                        )}
                        {!client.contact_phone &&
                          !client.contact_email &&
                          !client.contact_person && (
                            <span className="text-muted-foreground">-</span>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Loads & Date */}
                  <div className="flex items-center gap-8 flex-shrink-0">
                    <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                      <Package className="h-3 w-3" />
                      {customerLoads.length} loads
                    </Badge>

                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {safeFormatDate(client.created_at, 'dd MMM yyyy')}
                    </span>
                  </div>

                  {/* Actions - same style as Drivers & Fleet */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* View Dashboard */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      asChild
                      title="View Dashboard"
                    >
                      <Link to={`/customers/${client.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    {/* Copy Portal Link */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => copyPortalLink(client.id, client.name)}
                      title="Copy Portal Link"
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(client)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(client)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Customer Dialog */}
      <CreateClientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Edit Customer Dialog */}
      <EditClientDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={selectedClient}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium">{selectedClient?.name}</span>?
              This customer will be removed from the system. Existing loads will
              retain their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
