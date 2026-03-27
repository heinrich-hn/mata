import AddVendorDialog from "@/components/dialogs/AddVendorDialog";
import Layout from "@/components/Layout";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Vendor } from "@/types/vendor";
import { useQuery } from "@tanstack/react-query";
import { Edit, Plus, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";

const VendorsPage = () => {
  return (
    <Layout>
      <VendorsContent />
    </Layout>
  );
};

export function VendorsContent() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const { data: vendors = [], refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500); // Performance optimization

      if (error) throw error;
      return data as Vendor[];
    },
  });

  const filteredVendors = vendors.filter(vendor =>
    vendor.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVendors = filteredVendors.slice(startIndex, startIndex + itemsPerPage);

  const handleEdit = (vendor: Vendor) => {
    setEditVendor(vendor);
    setAddDialogOpen(true);
  };

  const handleDeleteClick = (vendor: Vendor) => {
    setVendorToDelete(vendor);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vendorToDelete) return;

    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", vendorToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });
      refetch();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete vendor",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setAddDialogOpen(false);
    setEditVendor(null);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vendors
            </CardTitle>
            <CardDescription>Total: {filteredVendors.length} vendors</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {paginatedVendors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vendors found. Add vendors to get started.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Vendor ID</TableHead>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>City</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(vendor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(vendor)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{vendor.vendor_id}</TableCell>
                        <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                        <TableCell>{vendor.contact_person || "-"}</TableCell>
                        <TableCell>{vendor.email || "-"}</TableCell>
                        <TableCell>{vendor.phone || "-"}</TableCell>
                        <TableCell>{vendor.street_address || "-"}</TableCell>
                        <TableCell>{vendor.city || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredVendors.length)} of {filteredVendors.length} vendors
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNumber}
                            size="sm"
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            onClick={() => handlePageChange(pageNumber)}
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AddVendorDialog
        open={addDialogOpen}
        onOpenChange={handleDialogClose}
        onAdd={refetch}
        editVendor={editVendor}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vendor "{vendorToDelete?.vendor_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default VendorsPage;