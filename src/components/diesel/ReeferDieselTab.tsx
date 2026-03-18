import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { REEFER_UNITS } from '@/constants/fleet';
import { useReeferConsumptionByTruck, useReeferConsumptionSummary, useReeferDieselRecords, useTruckDieselRecordsForLinking, type ReeferDieselRecordRow } from '@/hooks/useReeferDiesel';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import { AlertCircle, BarChart3, Edit, Filter, Plus, Snowflake, Trash2, Truck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReeferDieselEntryModal, { type ReeferDieselRecord } from './ReeferDieselEntryModal';

const ReeferDieselTab = () => {
  const [reeferFilter, setReeferFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'records' | 'summary' | 'by-truck'>('records');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ReeferDieselRecordRow | null>(null);

  const {
    records,
    isLoading,
    createRecordAsync,
    updateRecordAsync,
    deleteRecord,
  } = useReeferDieselRecords({
    reeferUnit: reeferFilter || undefined,
  });

  const { data: summaryData = [] } = useReeferConsumptionSummary();
  const { data: byTruckData = [] } = useReeferConsumptionByTruck();

  // Fetch linked diesel records for display
  const { data: truckDieselRecords = [] } = useTruckDieselRecordsForLinking();

  // Create a map of diesel record IDs to their info for quick lookup
  const dieselRecordMap = useMemo(() => {
    return new Map(truckDieselRecords.map(r => [r.id, r]));
  }, [truckDieselRecords]);

  // Calculate totals
  const totals = useMemo(() => {
    const validLphRecords = records.filter(r => r.litres_per_hour && r.litres_per_hour > 0);
    return {
      litres: records.reduce((sum, r) => sum + (r.litres_filled || 0), 0),
      cost: records.reduce((sum, r) => sum + (r.total_cost || 0), 0),
      hours: records.reduce((sum, r) => sum + (r.hours_operated || 0), 0),
      avgLph: validLphRecords.length > 0
        ? validLphRecords.reduce((sum, r) => sum + (r.litres_per_hour || 0), 0) / validLphRecords.length
        : 0,
      count: records.length,
    };
  }, [records]);

  const handleSaveRecord = async (record: ReeferDieselRecord) => {
    if (record.id) {
      await updateRecordAsync(record);
    } else {
      await createRecordAsync(record);
    }
    setIsEntryModalOpen(false);
    setEditRecord(null);
  };

  const handleEditRecord = (record: ReeferDieselRecordRow) => {
    setEditRecord(record);
    setIsEntryModalOpen(true);
  };

  const handleDeleteRecord = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      deleteRecord(recordId);
    }
  };

  // Helper to get linked diesel record info
  const getLinkedDieselInfo = (recordId: string | null) => {
    if (!recordId) return null;
    return dieselRecordMap.get(recordId) || null;
  };

  const renderRecordsList = () => (
    <div className="space-y-3">
      {records.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No reefer diesel records found. Click "Add Record" to create one.
          </AlertDescription>
        </Alert>
      ) : (
        records.map((record) => (
          <div
            key={record.id}
            className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Reefer & Date */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">{record.reefer_unit}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatDate(record.date)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {record.fuel_station || 'Unknown station'}
                  </p>
                  {record.driver_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Driver: {record.driver_name}
                    </p>
                  )}
                </div>

                {/* Litres & Cost */}
                <div>
                  <p className="text-sm font-medium">
                    {formatNumber(record.litres_filled)} L
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(record.total_cost, (record.currency || 'ZAR') as 'ZAR' | 'USD')}
                  </p>
                  {record.cost_per_litre && (
                    <p className="text-xs text-muted-foreground">
                      @ {formatCurrency(record.cost_per_litre, (record.currency || 'ZAR') as 'ZAR' | 'USD')}/L
                    </p>
                  )}
                </div>

                {/* Operating Hours & L/hr */}
                <div>
                  {record.operating_hours !== null && (
                    <p className="text-sm">
                      Hour Meter: <span className="font-medium">{formatNumber(record.operating_hours)} hrs</span>
                    </p>
                  )}
                  {record.hours_operated !== null && record.hours_operated > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Operated: {formatNumber(record.hours_operated)} hrs
                    </p>
                  )}
                  {record.litres_per_hour !== null && record.litres_per_hour > 0 && (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 mt-1">
                      {record.litres_per_hour.toFixed(2)} L/hr
                    </Badge>
                  )}
                </div>

                {/* Linked Diesel Transaction */}
                <div>
                  {(() => {
                    const linkedDiesel = getLinkedDieselInfo(record.linked_diesel_record_id);
                    if (linkedDiesel) {
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium text-success">
                              Horse {linkedDiesel.fleet_number}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(linkedDiesel.date)} • {formatNumber(linkedDiesel.litres_filled)}L
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {linkedDiesel.fuel_station}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <span className="text-sm text-muted-foreground italic">
                        Not linked
                      </span>
                    );
                  })()}
                  {record.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {record.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditRecord(record)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRecord(record.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSummaryView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {summaryData.length === 0 ? (
        <div className="col-span-full">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No consumption data available. Add some reefer diesel records first.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        summaryData.map((summary) => (
          <Card key={summary.reefer_unit}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Snowflake className="h-5 w-5 text-blue-500" />
                {summary.reefer_unit}
              </CardTitle>
              <CardDescription>
                {summary.fill_count} fill-ups since {formatDate(summary.first_fill_date)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Litres</p>
                  <p className="font-semibold">{formatNumber(summary.total_litres_filled)} L</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Cost</p>
                  <p className="font-semibold">{formatCurrency(summary.total_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hours Operated</p>
                  <p className="font-semibold">{formatNumber(summary.total_hours_operated)} hrs</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg L/hr</p>
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    {summary.avg_litres_per_hour.toFixed(2)} L/hr
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Last fill: {formatDate(summary.last_fill_date)}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderByTruckView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {byTruckData.length === 0 ? (
        <div className="col-span-full">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No reefer records are linked to truck diesel transactions yet. Link records when entering them to see combined reports.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        byTruckData.map((data) => (
          <Card key={data.fleet_number}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5 text-success" />
                Horse {data.fleet_number}
              </CardTitle>
              <CardDescription>
                Reefers: {data.reefer_units.join(', ')} • {data.fill_count} fill-ups
                {data.driver_name && ` • Driver: ${data.driver_name}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Reefer Diesel</p>
                  <p className="font-semibold">{formatNumber(data.total_reefer_litres)} L</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reefer Cost</p>
                  <p className="font-semibold">{formatCurrency(data.total_reefer_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Truck Diesel Cost</p>
                  <p className="font-semibold">{formatCurrency(data.total_truck_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Combined Cost</p>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    {formatCurrency(data.combined_cost)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with info badge */}
      <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Snowflake className="h-5 w-5 text-blue-500" />
        <span className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Reefer Diesel</strong> tracks refrigeration unit fuel consumption in <strong>Litres per Hour (L/hr)</strong>,
          separate from truck diesel which is tracked in km/L.
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Litres</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totals.litres)} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.cost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours Operated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totals.hours)} hrs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{totals.avgLph.toFixed(2)} L/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'records' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('records')}
            >
              Records
            </Button>
            <Button
              variant={viewMode === 'summary' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('summary')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Summary
            </Button>
            <Button
              variant={viewMode === 'by-truck' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('by-truck')}
            >
              <Truck className="h-4 w-4 mr-1" />
              By Truck
            </Button>
          </div>

          {/* Filters */}
          {viewMode === 'records' && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={reeferFilter}
                onChange={(e) => setReeferFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-md bg-background text-sm min-w-[120px]"
              >
                <option value="">All Reefers</option>
                {REEFER_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              {reeferFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReeferFilter('')}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <Button onClick={() => { setEditRecord(null); setIsEntryModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Reefer Diesel
        </Button>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'records' && 'Diesel Records'}
            {viewMode === 'summary' && 'Consumption by Reefer'}
            {viewMode === 'by-truck' && 'Consumption by Truck'}
          </CardTitle>
          <CardDescription>
            {viewMode === 'records' && `${records.length} records${reeferFilter ? ` for ${reeferFilter}` : ''}`}
            {viewMode === 'summary' && `Summary for ${summaryData.length} reefer units`}
            {viewMode === 'by-truck' && `Aggregated data for ${byTruckData.length} trucks`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {viewMode === 'records' && renderRecordsList()}
              {viewMode === 'summary' && renderSummaryView()}
              {viewMode === 'by-truck' && renderByTruckView()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Entry Modal */}
      <ReeferDieselEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => { setIsEntryModalOpen(false); setEditRecord(null); }}
        onSave={handleSaveRecord}
        editRecord={editRecord ? {
          id: editRecord.id,
          reefer_unit: editRecord.reefer_unit,
          date: editRecord.date,
          fuel_station: editRecord.fuel_station,
          litres_filled: editRecord.litres_filled,
          cost_per_litre: editRecord.cost_per_litre,
          total_cost: editRecord.total_cost,
          currency: editRecord.currency,
          operating_hours: editRecord.operating_hours,
          previous_operating_hours: editRecord.previous_operating_hours,
          hours_operated: editRecord.hours_operated,
          litres_per_hour: editRecord.litres_per_hour,
          linked_diesel_record_id: editRecord.linked_diesel_record_id,
          driver_name: editRecord.driver_name || '',
          notes: editRecord.notes || '',
        } : null}
      />
    </div>
  );
};

export default ReeferDieselTab;