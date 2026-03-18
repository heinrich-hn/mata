/**
 * Recurring Schedule Manager
 * UI for creating and managing automated load schedules
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import
  {
    createRecurringSchedule,
    deleteRecurringSchedule,
    formatDaysOfWeek,
    generateLoadsFromSchedule,
    getNextGenerationDates,
    getRecurringSchedules,
    toggleScheduleActive,
    updateRecurringSchedule,
    validateSchedule
  } from '@/lib/recurringSchedules';
import { DESTINATION_LOCATIONS, FARM_LOCATIONS } from '@/types/loadPlanning';
import type { CreateRecurringScheduleInput, RecurringSchedule } from '@/types/recurringSchedules';
import { FREQUENCY_LABELS, SCHEDULE_TEMPLATES, WEEKDAYS } from '@/types/recurringSchedules';
import { Calendar, Clock, MapPin, Package, Play, Plus, Power, PowerOff, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface RecurringScheduleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadsGenerated?: () => void;
}

export const RecurringScheduleManager = ({
  isOpen,
  onClose,
  onLoadsGenerated,
}: RecurringScheduleManagerProps) => {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null);
  const [formData, setFormData] = useState<Partial<CreateRecurringScheduleInput>>({
    frequency: 'weekly',
    days_of_week: [1, 3, 5],
    time_of_day: '06:00:00',
    delivery_offset_days: 1,
    priority: 'medium',
    currency: 'USD',
    pallet_count: 0,
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const { toast } = useToast();

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const data = await getRecurringSchedules();
      setSchedules(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load schedules',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    const errors = validateSchedule(formData);
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    try {
      await createRecurringSchedule({
        ...formData,
        days_of_week: selectedDays,
      } as CreateRecurringScheduleInput);

      toast({
        title: 'Schedule created',
        description: 'Recurring schedule created successfully',
      });

      setShowCreateDialog(false);
      resetForm();
      loadSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create schedule',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingSchedule) return;

    const errors = validateSchedule(formData);
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateRecurringSchedule(editingSchedule.id, {
        ...formData,
        days_of_week: selectedDays,
      } as Partial<CreateRecurringScheduleInput>);

      toast({
        title: 'Schedule updated',
        description: 'Recurring schedule updated successfully',
      });

      setEditingSchedule(null);
      resetForm();
      loadSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete schedule "${name}"?`)) return;

    try {
      await deleteRecurringSchedule(id);
      toast({
        title: 'Schedule deleted',
        description: 'Recurring schedule deleted successfully',
      });
      loadSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (schedule: RecurringSchedule) => {
    try {
      await toggleScheduleActive(schedule.id, !schedule.is_active);
      toast({
        title: schedule.is_active ? 'Schedule deactivated' : 'Schedule activated',
        description: schedule.is_active
          ? 'Loads will no longer be auto-generated'
          : 'Loads will be auto-generated based on schedule',
      });
      loadSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle schedule',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = async (schedule: RecurringSchedule) => {
    try {
      const result = await generateLoadsFromSchedule(schedule.id);
      toast({
        title: 'Loads generated',
        description: `Created ${result.generated_count} loads for the next 7 days`,
      });
      onLoadsGenerated?.();
      loadSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate loads',
        variant: 'destructive',
      });
    }
  };

  const handleUseTemplate = (template: Partial<CreateRecurringScheduleInput>) => {
    setFormData({ ...formData, ...template });
    setSelectedDays(template.days_of_week || [1, 3, 5]);
    setShowCreateDialog(true);
  };

  const handleEdit = (schedule: RecurringSchedule) => {
    setFormData({
      name: schedule.name,
      description: schedule.description,
      origin: schedule.origin,
      destination: schedule.destination,
      channel: schedule.channel,
      packaging_type: schedule.packaging_type,
      pallet_count: schedule.pallet_count,
      cargo_type: schedule.cargo_type,
      special_requirements: schedule.special_requirements,
      frequency: schedule.frequency,
      days_of_week: schedule.days_of_week,
      time_of_day: schedule.time_of_day,
      delivery_offset_days: schedule.delivery_offset_days,
      priority: schedule.priority,
      currency: schedule.currency,
    });
    setSelectedDays(schedule.days_of_week || []);
    setEditingSchedule(schedule);
  };

  const resetForm = () => {
    setFormData({
      frequency: 'weekly',
      days_of_week: [1, 3, 5],
      time_of_day: '06:00:00',
      delivery_offset_days: 1,
      priority: 'medium',
      currency: 'USD',
      pallet_count: 0,
    });
    setSelectedDays([1, 3, 5]);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recurring Load Schedules
          </DialogTitle>
          <DialogDescription>
            Automate your regular routes - loads will be generated automatically based on your schedule
          </DialogDescription>
        </DialogHeader>

        {/* Quick Templates */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Quick Templates
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {SCHEDULE_TEMPLATES.map((template, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleUseTemplate(template)}
                className="justify-start"
              >
                <Plus className="w-3 h-3 mr-2" />
                {template.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Existing Schedules */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Your Schedules ({schedules.length})</Label>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Custom
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No recurring schedules yet. Create one from templates or start from scratch.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {schedules.map(schedule => {
                const nextDates = getNextGenerationDates(schedule, 3);
                return (
                  <Card key={schedule.id} className={!schedule.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {schedule.name}
                            {schedule.is_active ? (
                              <Power className="w-4 h-4 text-green-600" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-gray-400" />
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {schedule.description || 'No description'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(schedule)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(schedule)}
                          >
                            {schedule.is_active ? 'Pause' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(schedule.id, schedule.name)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">{schedule.origin} → {schedule.destination}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">
                            {FREQUENCY_LABELS[schedule.frequency]}
                            {schedule.frequency === 'weekly' && ` (${formatDaysOfWeek(schedule.days_of_week)})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">
                            {schedule.channel} - {schedule.packaging_type}
                            {schedule.pallet_count ? ` (${schedule.pallet_count} pallets)` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">
                            Pickup: {schedule.time_of_day?.substring(0, 5) || '06:00'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                          Generated: <span className="font-medium">{schedule.total_loads_generated || 0}</span> loads
                          {schedule.last_generated_date && (
                            <span> · Last: {new Date(schedule.last_generated_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        {schedule.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerate(schedule)}
                          >
                            <Play className="w-3 h-3 mr-2" />
                            Generate Now
                          </Button>
                        )}
                      </div>

                      {schedule.is_active && nextDates.length > 0 && (
                        <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                          <strong>Next runs:</strong> {nextDates.map(d => d.toLocaleDateString()).join(', ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingSchedule(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit' : 'Create'} Recurring Schedule</DialogTitle>
            <DialogDescription>
              Set up automated load generation for recurring routes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Schedule Name *</Label>
                <Input
                  placeholder="e.g., Harare Retail Daily"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Optional description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Origin (Farm) *</Label>
                <Select
                  value={formData.origin || ''}
                  onValueChange={(value) => setFormData({ ...formData, origin: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(FARM_LOCATIONS).map(farm => (
                      <SelectItem key={farm} value={farm}>{farm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select
                  value={formData.destination || ''}
                  onValueChange={(value) => setFormData({ ...formData, destination: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(DESTINATION_LOCATIONS).map(dest => (
                      <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={formData.channel || ''}
                  onValueChange={(value: string) => setFormData({ ...formData, channel: value as 'retail' | 'vendor' | 'vansales' | 'direct' | 'municipal' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="vansales">Vansales</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Packaging</Label>
                <Select
                  value={formData.packaging_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, packaging_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crates">Crates</SelectItem>
                    <SelectItem value="bins">Bins</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                    <SelectItem value="pallets">Pallets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pallet Count</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.pallet_count || 0}
                  onChange={(e) => setFormData({ ...formData, pallet_count: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority || 'medium'}
                  onValueChange={(value: string) => setFormData({ ...formData, priority: value as 'low' | 'medium' | 'high' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Frequency *</Label>
                <Select
                  value={formData.frequency || 'weekly'}
                  onValueChange={(value: string) => setFormData({ ...formData, frequency: value as 'daily' | 'weekly' | 'monthly' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency === 'weekly' && (
                <div className="col-span-2 space-y-2">
                  <Label>Days of Week *</Label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.short}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Pickup Time</Label>
                <Input
                  type="time"
                  value={formData.time_of_day?.substring(0, 5) || '06:00'}
                  onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value + ':00' })}
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Offset (days)</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.delivery_offset_days || 1}
                  onChange={(e) => setFormData({ ...formData, delivery_offset_days: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingSchedule(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={editingSchedule ? handleUpdate : handleCreate}>
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
