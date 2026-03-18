import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import
    {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle,
    } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import
    {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Package, Search } from "lucide-react";
import { useState } from "react";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];

interface InventorySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: InventoryItem) => void;
}

export default function InventorySearchDialog({
  open,
  onOpenChange,
  onSelect,
}: InventorySearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");

  // Fetch inventory items
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["inventory", "search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: open,
  });

  // Get unique categories
  const categories = Array.from(
    new Set(inventoryItems.map((item) => item.category).filter(Boolean))
  ).sort();

  // Filter inventory based on search, category, and stock level
  const filteredItems = inventoryItems.filter((item) => {
    // Search filter
    const matchesSearch =
      searchTerm === "" ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

    // Category filter
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    // Stock filter
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "in-stock" &&
        (item.quantity || 0) > (item.min_quantity || 0)) ||
      (stockFilter === "low-stock" &&
        (item.quantity || 0) > 0 &&
        (item.quantity || 0) <= (item.min_quantity || 0));

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleSelectItem = (item: InventoryItem) => {
    onSelect(item);
    onOpenChange(false);
    // Reset filters
    setSearchTerm("");
    setSelectedCategory("all");
    setStockFilter("all");
  };

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return {
        label: "Out of Stock",
        color: "destructive" as const,
        icon: AlertTriangle,
      };
    } else if (quantity <= minQuantity) {
      return {
        label: "Low Stock",
        color: "outline" as const,
        icon: AlertTriangle
      };
    } else {
      return {
        label: "In Stock",
        color: "default" as const,
        icon: CheckCircle2
      };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select from Inventory
          </DialogTitle>
          <DialogDescription>
            Search and select inventory items to add to your parts request.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, part number, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="flex gap-4">
            {/* Category Filter */}
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category!}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stock Level Filter */}
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Stock Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Levels</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>

            {/* Results Count */}
            <div className="ml-auto flex items-center text-sm text-muted-foreground">
              {filteredItems.length}{" "}
              {filteredItems.length === 1 ? "item" : "items"} found
            </div>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-muted-foreground">Loading inventory...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No items found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(
                  item.quantity || 0,
                  item.min_quantity || 0
                );
                const StockIcon = stockStatus.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="w-full p-4 border rounded-lg hover:bg-accent hover:border-primary transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Item Info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{item.name}</h4>
                          {item.category && (
                            <Badge variant="outline">{item.category}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Part #: {item.part_number || "N/A"}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Location: {item.location || "N/A"}
                          </span>
                          <span className="text-muted-foreground">
                            Supplier: {item.supplier || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Right: Stock & Price */}
                      <div className="text-right space-y-2">
                        <div className="text-lg font-semibold text-primary">
                          ${item.unit_price?.toFixed(2) || "0.00"}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <StockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {item.quantity || 0} units
                          </span>
                        </div>
                        <Badge variant={stockStatus.color}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}