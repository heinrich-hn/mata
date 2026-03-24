import { useState } from "react";
import { Settings, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Bell, Mail, Smartphone } from "lucide-react";
import { useAlertConfigs, useCreateAlertConfig, useUpdateAlertConfig, useDeleteAlertConfig } from "@/hooks/useAlertConfigs";
import type { AlertConfiguration, AlertCategory, AlertSeverity } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Category labels ──────────────────────────────────────────────────────────
const CATEGORIES: { value: AlertCategory; label: string }[] = [
  { value: "speed_violation", label: "Speed Violation" },
  { value: "geofence_breach", label: "Geofence Breach" },
  { value: "fuel_anomaly", label: "Fuel Anomaly" },
  { value: "maintenance_due", label: "Maintenance Due" },
  { value: "driver_behavior", label: "Driver Behavior" },
  { value: "vehicle_fault", label: "Vehicle Fault" },
  { value: "trip_delay", label: "Trip Delay" },
  { value: "load_exception", label: "Load Exception" },
  { value: "tyre_pressure", label: "Tyre Pressure" },
  { value: "custom", label: "Custom" },
];

const SEVERITIES: { value: AlertSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
];

// ─── Config form ──────────────────────────────────────────────────────────────
interface ConfigFormState {
  name: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  cooldown_minutes: number;
  notify_in_app: boolean;
  notify_push: boolean;
  notify_email: boolean;
  is_active: boolean;
}

const EMPTY_FORM: ConfigFormState = {
  name: "",
  description: "",
  category: "speed_violation",
  severity: "high",
  cooldown_minutes: 15,
  notify_in_app: true,
  notify_push: true,
  notify_email: false,
  is_active: true,
};

function configToForm(config: AlertConfiguration): ConfigFormState {
  return {
    name: config.name,
    description: config.description ?? "",
    category: config.category,
    severity: config.severity,
    cooldown_minutes: config.cooldown_minutes,
    notify_in_app: config.notify_in_app,
    notify_push: config.notify_push,
    notify_email: config.notify_email,
    is_active: config.is_active,
  };
}

// ─── Alert Rule Card ──────────────────────────────────────────────────────────
interface RuleCardProps {
  config: AlertConfiguration;
  onEdit: (config: AlertConfiguration) => void;
  onToggle: (config: AlertConfiguration) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function RuleCard({ config, onEdit, onToggle, onDelete, isDeleting }: RuleCardProps) {
  return (
    <div className={cn(
      "monitor-soft-entry rounded-xl p-4 space-y-3 transition-opacity",
      !config.is_active && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {CATEGORIES.find((c) => c.value === config.category)?.label ?? config.category}
            </span>
            {!config.is_active && (
              <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                DISABLED
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">{config.name}</p>
          {config.description && (
            <p className="text-xs text-slate-500 mt-1">{config.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggle(config)}
            className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={config.is_active ? "Disable rule" : "Enable rule"}
          >
            {config.is_active
              ? <ToggleRight className="h-4 w-4 text-slate-700" />
              : <ToggleLeft className="h-4 w-4" />
            }
          </button>
          <button
            onClick={() => onEdit(config)}
            className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Edit rule"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(config.id)}
            disabled={isDeleting}
            className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete rule"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notification badges */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Notify via:</span>
        {config.notify_in_app && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
            <Bell className="h-2.5 w-2.5" /> In-App
          </span>
        )}
        {config.notify_push && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
            <Smartphone className="h-2.5 w-2.5" /> Push
          </span>
        )}
        {config.notify_email && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
            <Mail className="h-2.5 w-2.5" /> Email
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">
          Cooldown: {config.cooldown_minutes}m
        </span>
      </div>
    </div>
  );
}

// ─── Config Form Modal ────────────────────────────────────────────────────────
interface FormModalProps {
  form: ConfigFormState;
  editingId: string | null;
  onFieldChange: (field: keyof ConfigFormState, value: unknown) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function FormModal({ form, editingId, onFieldChange, onSubmit, onCancel, isSaving }: FormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="monitor-soft-panel rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900">
            {editingId ? "Edit Alert Rule" : "New Alert Rule"}
          </h2>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-slate-600 font-medium">Rule Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="e.g. Speed Violation — Highway"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs text-slate-600 font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => onFieldChange("description", e.target.value)}
              rows={2}
              placeholder="Optional description…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
            />
          </div>

          {/* Category + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-600 font-medium">Category</label>
              <select
                value={form.category}
                onChange={(e) => onFieldChange("category", e.target.value as AlertCategory)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600 font-medium">Default Severity</label>
              <select
                value={form.severity}
                onChange={(e) => onFieldChange("severity", e.target.value as AlertSeverity)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cooldown */}
          <div className="space-y-1">
            <label className="text-xs text-slate-600 font-medium">
              Cooldown (minutes) — prevent duplicate alerts
            </label>
            <input
              type="number"
              min={0}
              max={1440}
              value={form.cooldown_minutes}
              onChange={(e) => onFieldChange("cooldown_minutes", Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
            />
          </div>

          {/* Notifications */}
          <div className="space-y-2">
            <p className="text-xs text-slate-600 font-medium">Notification Channels</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "notify_in_app", icon: Bell, label: "In-App" },
                { key: "notify_push", icon: Smartphone, label: "Push" },
                { key: "notify_email", icon: Mail, label: "Email" },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFieldChange(key, !form[key])}
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-all",
                    form[key]
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Rule Active</p>
              <p className="text-xs text-slate-500">Disable to pause without deleting</p>
            </div>
            <button
              type="button"
              onClick={() => onFieldChange("is_active", !form.is_active)}
              className={cn(
                "relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none",
                form.is_active ? "bg-slate-900" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1",
                  form.is_active ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!form.name.trim() || isSaving}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving…" : editingId ? "Update Rule" : "Create Rule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfigPage() {
  const { data: configs = [], isLoading } = useAlertConfigs();
  const createConfig = useCreateAlertConfig();
  const updateConfig = useUpdateAlertConfig();
  const deleteConfig = useDeleteAlertConfig();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigFormState>(EMPTY_FORM);

  const handleFieldChange = (field: keyof ConfigFormState, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (config: AlertConfiguration) => {
    setForm(configToForm(config));
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateConfig.mutateAsync({ id: editingId, ...form, conditions: {} });
        toast.success("Alert rule updated");
      } else {
        await createConfig.mutateAsync({ ...form, conditions: {} });
        toast.success("Alert rule created");
      }
      setShowForm(false);
    } catch {
      toast.error("Failed to save alert rule");
    }
  };

  const handleToggle = async (config: AlertConfiguration) => {
    try {
      await updateConfig.mutateAsync({ id: config.id, is_active: !config.is_active });
      toast.success(config.is_active ? "Rule disabled" : "Rule enabled");
    } catch {
      toast.error("Failed to update rule");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this alert rule? This cannot be undone.")) return;
    try {
      await deleteConfig.mutateAsync(id);
      toast.success("Alert rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const activeCount = configs.filter((c) => c.is_active).length;
  const disabledCount = configs.filter((c) => !c.is_active).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="monitor-page max-w-3xl pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 monitor-page-header p-4">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-slate-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">Alert Rules</h1>
              <p className="text-xs text-slate-500">
                {activeCount} active · {disabledCount} disabled
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        </div>

        {/* Info banner */}
        <div className="monitor-soft-panel rounded-xl p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900 mb-1">How alert rules work</p>
          <p>
            Rules define how alerts are categorized and who gets notified. They are evaluated by the{" "}
            <code className="text-slate-700 text-xs bg-slate-100 px-1 rounded">alert-processor</code>{" "}
            Supabase Edge Function when new events arrive from vehicles, drivers, and operations.
          </p>
        </div>

        {/* Rules list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 monitor-soft-panel border-dashed rounded-xl">
            <Settings className="h-8 w-8 text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-900">No alert rules yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Create rules to configure how alerts are triggered and who is notified.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <RuleCard
                key={config.id}
                config={config}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isDeleting={deleteConfig.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <FormModal
          form={form}
          editingId={editingId}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSaving={createConfig.isPending || updateConfig.isPending}
        />
      )}
    </div>
  );
}