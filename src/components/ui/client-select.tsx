import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

interface Client {
  id: string;
  name: string;
}

interface ClientSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onClientCreated?: (clientName: string) => void;
}

export const ClientSelect = ({
  value,
  onValueChange,
  placeholder = 'Select client...',
  disabled = false,
  allowCreate = false,
  onClientCreated,
}: ClientSelectProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Fetch active clients from clients table
  const { data: clients = [], isLoading, error } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleCreateClient = async () => {
    const trimmedName = newClientName.trim();
    if (!trimmedName) {
      toast({
        title: 'Error',
        description: 'Client name is required',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (clients.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: 'Client exists',
        description: `"${trimmedName}" already exists. Selecting it now.`,
      });
      onValueChange(trimmedName);
      setNewClientName('');
      setNewClientNotes('');
      setIsDialogOpen(false);
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('clients')
        .insert([{
          name: trimmedName,
          notes: newClientNotes.trim() || null,
          active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh clients list
      await queryClient.invalidateQueries({ queryKey: ['clients'] });

      toast({
        title: 'Client Added',
        description: `${trimmedName} has been added successfully.`,
      });

      // Select the new client
      onValueChange(trimmedName);
      onClientCreated?.(trimmedName);

      // Reset form and close dialog
      setNewClientName('');
      setNewClientNotes('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Error creating client:', err);
      toast({
        title: 'Error',
        description: 'Failed to create client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Find the current client to show in display
  const currentClient = clients.find(c => c.name === value);

  if (isLoading) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading clients...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border border-destructive bg-destructive/10">
        <span className="text-sm text-destructive">Error loading clients</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Select
          value={value || undefined}
          onValueChange={onValueChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder}>
              {currentClient ? (
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {currentClient.name}
                </span>
              ) : value ? (
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {value}
                </span>
              ) : (
                placeholder
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clients.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No clients found. Click + to add one.
              </div>
            ) : (
              clients.map((client) => (
                <SelectItem key={client.id} value={client.name}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {client.name}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {allowCreate && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsDialogOpen(true)}
            disabled={disabled}
            title="Add new client"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick Add Client Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Quickly add a new client to the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name *</Label>
              <Input
                id="client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g., Acme Corp, Gold Mining Ltd"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateClient();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-notes">Notes (Optional)</Label>
              <Input
                id="client-notes"
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
                placeholder="e.g., Contact person, location, contract notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setNewClientName('');
                setNewClientNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateClient}
              disabled={isCreating || !newClientName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientSelect;