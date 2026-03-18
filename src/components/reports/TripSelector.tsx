import { useState } from 'react';
import { Trip } from '@/types/operations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Truck, User, Calendar, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface TripSelectorProps {
  trips: Trip[];
  onSelectTrip: (trip: Trip) => void;
}

const TripSelector = ({ trips, onSelectTrip }: TripSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrips = trips.filter(trip => {
    const query = searchQuery.toLowerCase();
    return (
      trip.trip_number.toLowerCase().includes(query) ||
      trip.driver_name?.toLowerCase().includes(query) ||
      trip.client_name?.toLowerCase().includes(query) ||
      trip.origin?.toLowerCase().includes(query) ||
      trip.destination?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'active':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search trips by number, driver, client, or route..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrips.map((trip) => (
          <Card key={trip.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelectTrip(trip)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{trip.trip_number}</CardTitle>
                <Badge className={getStatusColor(trip.status || 'pending')}>
                  {trip.status}
                </Badge>
              </div>
              <CardDescription>{trip.client_name || 'No client'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>{trip.vehicle_id || 'No vehicle assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{trip.driver_name || 'No driver assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{formatDate(trip.departure_date)} - {formatDate(trip.arrival_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{trip.origin} → {trip.destination}</span>
              </div>
              <Button className="w-full mt-4" size="sm">
                View Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTrips.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No trips found matching your search criteria
        </div>
      )}
    </div>
  );
};

export default TripSelector;