import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { type SearchResult, geocoding } from "@/utils/geocoding";
import { Separator } from "@radix-ui/react-separator";
import { useQuery } from "@tanstack/react-query";
import { Check, Globe, MapPin, Search } from "lucide-react";
import { useState } from "react";

// Define types
type LocationType = Database["public"]["Enums"]["location_type"];
interface LocationDisplay {
  id: string;
  name: string;
  short_code: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  location_type: string;
  country: string;
  is_favorite: boolean;
  is_active: boolean;
}

interface LocationSelectorProps {
  value?: string;
  onSelect: (location: LocationDisplay) => void;
  placeholder?: string;
  country?: string;
  locationType?: LocationType;
}

const LocationSelector = ({
  value,
  onSelect,
  placeholder = "Select location...",
  country,
  locationType,
}: LocationSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addressSearchResults, setAddressSearchResults] = useState<SearchResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Fetch predefined locations
  const { data: locations = [], isLoading } = useQuery<LocationDisplay[], Error>({
    queryKey: ["predefined-locations", country, locationType],
    queryFn: fetchLocations,
  });

  // Fetch predefined locations from Supabase
  async function fetchLocations(): Promise<LocationDisplay[]> {
    let query = supabase
      .from("predefined_locations")
      .select("id, name, short_code, address, latitude, longitude, location_type, country, is_favorite, is_active")
      .eq("is_active", true);

    if (country) {
      query = query.eq("country", country);
    }
    if (locationType) {
      query = query.eq("location_type", locationType);
    }

    const { data, error } = await query
      .order("is_favorite", { ascending: false })
      .order("name");

    if (error) throw error;
    return (data as LocationDisplay[]) || [];
  }

  // Handle address search
  const handleAddressSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setAddressSearchResults([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const results = await geocoding.searchAddress(query);
      setAddressSearchResults(results);
    } catch (error) {
      console.error('Address search error:', error);
      setAddressSearchResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Filter and group locations
  const filteredLocations = locations.filter((loc) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      loc.name.toLowerCase().includes(searchLower) ||
      loc.short_code?.toLowerCase().includes(searchLower) ||
      loc.address?.toLowerCase().includes(searchLower) ||
      loc.country.toLowerCase().includes(searchLower)
    );
  });

  // Group locations by country
  const groupedLocations = filteredLocations.reduce<Record<string, LocationDisplay[]>>((acc, loc) => {
    acc[loc.country] = acc[loc.country] || [];
    acc[loc.country].push(loc);
    return acc;
  }, {});

  const selectedLocation = locations.find((loc) => loc.id === value);

  // Get location type icon
  const getLocationTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      depot: "🏢",
      customer: "👥",
      border_post: "🛂",
      truck_stop: "⛽",
      toll_gate: "💰",
      market: "🏪",
      port: "🚢",
      supplier: "📦",
    };
    return icons[type] || "📍";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedLocation ? (
            <span className="flex items-center gap-2">
              <span>{getLocationTypeIcon(selectedLocation.location_type)}</span>
              <span className="truncate">{selectedLocation.name}</span>
              {selectedLocation.short_code && (
                <span className="text-xs text-gray-500">({selectedLocation.short_code})</span>
              )}
            </span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search locations or addresses..."
            value={searchQuery}
            onValueChange={handleAddressSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading locations...</div>
            ) : (
              <>
                {/* Address Search Results */}
                {addressSearchResults.length > 0 && (
                  <>
                    <CommandGroup heading={<span className="flex items-center gap-2"><Globe className="h-3 w-3" /> Address Search Results</span>}>
                      {addressSearchResults.slice(0, 5).map((result, idx) => (
                        <CommandItem
                          key={`address-${idx}`}
                          value={result.label}
                          onSelect={() => {
                            onSelect({
                              id: `address-${Date.now()}`,
                              name: result.label,
                              short_code: null,
                              address: result.label,
                              latitude: result.y,
                              longitude: result.x,
                              location_type: 'custom',
                              country: '',
                              is_favorite: false,
                              is_active: true
                            });
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm truncate block">{result.label}</span>
                            </div>
                          </div>
                          <Check className={cn("ml-2 h-4 w-4", "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <Separator />
                  </>
                )}

                {/* Predefined Locations */}
                {filteredLocations.length === 0 && addressSearchResults.length === 0 ? (
                  <CommandEmpty>{isSearchingAddress ? "Searching..." : "No locations found."}</CommandEmpty>
                ) : (
                  Object.entries(groupedLocations).map(([countryName, locs]) => (
                    <CommandGroup key={countryName} heading={countryName}>
                      {locs.map((loc) => (
                        <CommandItem
                          key={loc.id}
                          value={loc.id}
                          onSelect={() => {
                            onSelect(loc);
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span>{getLocationTypeIcon(loc.location_type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{loc.name}</span>
                                {loc.short_code && (
                                  <span className="text-xs text-gray-500">{loc.short_code}</span>
                                )}
                                {loc.is_favorite && <span className="text-xs">⭐</span>}
                              </div>
                              {loc.address && (
                                <div className="text-xs text-gray-500 truncate">{loc.address}</div>
                              )}
                            </div>
                            <Check className={cn("ml-2 h-4 w-4", value === loc.id ? "opacity-100" : "opacity-0")} />
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default LocationSelector;
