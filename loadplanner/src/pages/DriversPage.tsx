import { CreateDriverDialog, EditDriverDialog, ViewDriverDialog } from '@/components/drivers';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteDriver, useDrivers, type Driver } from '@/hooks/useDrivers';
import { cn } from '@/lib/utils';
import { Eye, Pencil, Phone, Plus, Trash2, User } from 'lucide-react';
import { useState } from 'react';

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const deleteDriver = useDeleteDriver();

  const handleViewClick = (driver: Driver) => {
    setSelectedDriver(driver);
    setViewDialogOpen(true);
  };

  const handleEditClick = (driver: Driver) => {
    setSelectedDriver(driver);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (driverToDelete) {
      deleteDriver.mutate(driverToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setDriverToDelete(null);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* List-style loading skeletons */}
        <div className="rounded-xl border bg-card">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-6 p-6 border-b last:border-none"
            >
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
          </Button>
        </div>

        {drivers.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No drivers found</h3>
            <p className="text-muted-foreground mb-4">Add drivers to get started</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Driver
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center gap-6 p-6 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                {/* Avatar + Name + Badge */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    {driver.photo_url ? (
                      <AvatarImage src={driver.photo_url} alt={driver.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {driver.name.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold truncate">{driver.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          driver.available
                            ? 'bg-status-scheduled-bg text-status-scheduled border-status-scheduled/20'
                            : 'bg-status-transit-bg text-status-transit border-status-transit/20'
                        )}
                      >
                        {driver.available ? 'Available' : 'On Route'}
                      </Badge>
                    </div>

                    {/* Contact */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Phone className="h-4 w-4" />
                      <span className="truncate">{driver.contact}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleViewClick(driver)}
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleEditClick(driver)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteClick(driver)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs remain unchanged */}
      <CreateDriverDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <ViewDriverDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} driver={selectedDriver} />

      <EditDriverDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} driver={selectedDriver} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{driverToDelete?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDriver.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
