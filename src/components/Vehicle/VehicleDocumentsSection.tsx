import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COMMON_DOC_TYPES = [
    { value: "license_disk", label: "License Disk" },
    { value: "roadworthy", label: "Roadworthy" },
    { value: "insurance", label: "Insurance" },
    { value: "mot", label: "MOT" },
    { value: "cof", label: "COF" },
    { value: "permit", label: "Permit" },
];

export interface PendingDocument {
    id: string;
    type: string;
    customType: string;
    number: string;
    expiry: Date | undefined;
    file: File | null;
}

interface TrackedDoc {
    id: string;
    document_type: string | null;
    document_category: string | null;
    document_number: string;
    title: string;
    file_name: string;
    file_url: string;
    metadata: { expiry_date?: string } | null;
    uploaded_at: string | null;
}

interface VehicleDocumentsSectionProps {
    vehicleId?: string;
    pendingDocuments?: PendingDocument[];
    onPendingDocumentsChange?: (docs: PendingDocument[]) => void;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

const isDateOverdue = (dateString: string) => new Date(dateString) < new Date();

const isDateSoon = (dateString: string, daysThreshold = 30) => {
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= daysThreshold && days >= 0;
};

const VehicleDocumentsSection = ({
    vehicleId,
    pendingDocuments,
    onPendingDocumentsChange,
}: VehicleDocumentsSectionProps) => {
    const { toast } = useToast();
    const isLive = !!vehicleId;

    // Live mode state
    const [docs, setDocs] = useState<TrackedDoc[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingExpiry, setEditingExpiry] = useState<Record<string, Date | undefined>>({});

    // File input ref for proper reset
    const fileInputRef = useRef<HTMLInputElement>(null);

    // New doc form state
    const [newDoc, setNewDoc] = useState<{
        type: string;
        customType: string;
        number: string;
        expiry: Date | undefined;
        file: File | null;
    }>({ type: "license_disk", customType: "", number: "", expiry: undefined, file: null });

    const resetNewDoc = () => {
        setNewDoc({ type: "license_disk", customType: "", number: "", expiry: undefined, file: null });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ── Live mode: fetch existing docs ──
    const fetchDocs = async () => {
        if (!vehicleId) return;
        setLoadingDocs(true);
        const { data, error } = await supabase
            .from("work_documents")
            .select(
                "id, document_type, document_category, document_number, title, file_name, file_url, metadata, uploaded_at"
            )
            .eq("vehicle_id", vehicleId)
            .order("uploaded_at", { ascending: false });
        if (!error && data) setDocs(data as unknown as TrackedDoc[]);
        setLoadingDocs(false);
    };

    useEffect(() => {
        if (isLive) fetchDocs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleId]);

    // ── Live mode: add document ──
    const handleAddDocLive = async () => {
        if (!vehicleId) return;
        setAdding(true);
        try {
            let publicUrl = "";
            let fileName = "No file";
            let fileFormat = "none";

            if (newDoc.file) {
                const ext = newDoc.file.name.split(".").pop() || "dat";
                const path = `vehicle-documents/${vehicleId}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("documents")
                    .upload(path, newDoc.file);
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
                publicUrl = urlData?.publicUrl as string;
                fileName = newDoc.file.name;
                fileFormat = ext;
            }

            const category = newDoc.type === "custom" ? newDoc.customType : newDoc.type;
            const docNumber = newDoc.number || category.toUpperCase();

            const { error } = await supabase.from("work_documents").insert({
                vehicle_id: vehicleId,
                document_type: "other" as const,
                document_category: category,
                document_number: docNumber,
                title: `${category.toUpperCase()} ${docNumber}`,
                file_name: fileName,
                file_format: fileFormat,
                file_url: publicUrl,
                uploaded_by: "system",
                metadata: newDoc.expiry
                    ? { expiry_date: newDoc.expiry.toISOString().split("T")[0] }
                    : null,
            });
            if (error) throw error;

            resetNewDoc();
            await fetchDocs();
            toast({ title: "Document added" });
        } catch (err) {
            console.error("Failed to add document:", err);
            toast({ title: "Failed to add document", description: String(err), variant: "destructive" });
        } finally {
            setAdding(false);
        }
    };

    // ── Live mode: update expiry ──
    const handleUpdateExpiry = async (docId: string) => {
        const nextExpiry = editingExpiry[docId];
        const target = docs.find((d) => d.id === docId);
        const meta = {
            ...(target?.metadata || {}),
            expiry_date: nextExpiry ? nextExpiry.toISOString().split("T")[0] : undefined,
        };
        const { error } = await supabase
            .from("work_documents")
            .update({ metadata: meta })
            .eq("id", docId);
        if (error) {
            toast({ title: "Failed to update expiry", variant: "destructive" });
            return;
        }
        await fetchDocs();
        setEditingId(null);
        toast({ title: "Expiry updated" });
    };

    // ── Live mode: delete document ──
    const handleDeleteDoc = async (docId: string) => {
        const { error } = await supabase.from("work_documents").delete().eq("id", docId);
        if (error) {
            toast({ title: "Failed to remove document", variant: "destructive" });
            return;
        }
        await fetchDocs();
        toast({ title: "Document removed" });
    };

    // ── Deferred mode: add to pending list ──
    const handleAddDocDeferred = () => {
        if (!pendingDocuments || !onPendingDocumentsChange) return;
        const docType = newDoc.type === "custom" ? newDoc.customType : newDoc.type;
        const doc: PendingDocument = {
            id: crypto.randomUUID(),
            type: docType,
            customType: newDoc.customType,
            number: newDoc.number || docType.toUpperCase(),
            expiry: newDoc.expiry,
            file: newDoc.file,
        };
        onPendingDocumentsChange([...pendingDocuments, doc]);
        resetNewDoc();
    };

    // ── Deferred mode: remove from pending list ──
    const handleRemovePending = (id: string) => {
        if (!pendingDocuments || !onPendingDocumentsChange) return;
        onPendingDocumentsChange(pendingDocuments.filter((d) => d.id !== id));
    };

    // ── Form submit handler ──
    const handleAddDoc = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (
            !newDoc.expiry ||
            (newDoc.type === "custom" && !newDoc.customType)
        ) {
            toast({
                title: "Missing fields",
                description: "Type and expiry date are required",
                variant: "destructive",
            });
            return;
        }
        if (isLive) {
            handleAddDocLive();
        } else {
            handleAddDocDeferred();
        }
    };

    // ── Expiry badge helper ──
    const getExpiryBadge = (expiry: string | undefined) => {
        if (!expiry) return <Badge variant="outline">No expiry set</Badge>;
        const overdue = isDateOverdue(expiry);
        const soon = !overdue && isDateSoon(expiry);
        return (
            <Badge
                className={
                    overdue
                        ? "bg-red-100 text-red-700"
                        : soon
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-emerald-100 text-emerald-700"
                }
            >
                {overdue
                    ? `Expired ${formatDate(expiry)}`
                    : soon
                        ? `Expiring ${formatDate(expiry)}`
                        : `Valid until ${formatDate(expiry)}`}
            </Badge>
        );
    };

    return (
        <div className="space-y-4 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Vehicle Documents
            </Label>

            {/* Add document form */}
            <div className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                            value={newDoc.type}
                            onValueChange={(v) => setNewDoc((s) => ({ ...s, type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_DOC_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {newDoc.type === "custom" && (
                        <div className="space-y-1">
                            <Label className="text-xs">Custom Type</Label>
                            <Input
                                value={newDoc.customType}
                                onChange={(e) => setNewDoc((s) => ({ ...s, customType: e.target.value }))}
                                placeholder="Enter type name"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label className="text-xs">Number</Label>
                        <Input
                            value={newDoc.number}
                            onChange={(e) => setNewDoc((s) => ({ ...s, number: e.target.value }))}
                            placeholder="e.g. LIC-12345"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">Expiry Date</Label>
                        <DatePicker
                            value={newDoc.expiry}
                            onChange={(date) => setNewDoc((s) => ({ ...s, expiry: date }))}
                            placeholder="Select date"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs">File</Label>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="*/*"
                            onChange={(e) =>
                                setNewDoc((s) => ({ ...s, file: e.target.files?.[0] || null }))
                            }
                        />
                    </div>
                    <Button type="button" size="sm" disabled={adding} onClick={handleAddDoc}>
                        <Plus className="h-4 w-4 mr-1" />
                        {adding ? "Adding…" : "Add"}
                    </Button>
                </div>
            </div>

            {/* ── Live mode: Existing documents ── */}
            {isLive && (
                <>
                    {loadingDocs ? (
                        <p className="text-sm text-muted-foreground">Loading documents…</p>
                    ) : docs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No documents tracked yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {docs.map((d) => {
                                const expiry = d?.metadata?.expiry_date;
                                const category =
                                    d.document_category ||
                                    d.document_type ||
                                    "document";
                                return (
                                    <div
                                        key={d.id}
                                        className="border rounded-md p-2 space-y-2"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium truncate text-sm">
                                                    {d.title || `${category.toUpperCase()} ${d.document_number}`}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {d.file_name}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {editingId !== d.id && (
                                                    <>
                                                        {getExpiryBadge(expiry)}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit expiry"
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingExpiry((prev) => ({
                                                                    ...prev,
                                                                    [d.id]: expiry ? new Date(expiry) : undefined,
                                                                }));
                                                                setEditingId(d.id);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <a
                                                            href={d.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs underline"
                                                        >
                                                            Open
                                                        </a>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Remove document"
                                                            type="button"
                                                            onClick={() => handleDeleteDoc(d.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {editingId === d.id && (
                                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                                                <div className="flex-1 min-w-[160px]">
                                                    <DatePicker
                                                        value={editingExpiry[d.id]}
                                                        onChange={(date) =>
                                                            setEditingExpiry((prev) => ({ ...prev, [d.id]: date }))
                                                        }
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    type="button"
                                                    onClick={() => handleUpdateExpiry(d.id)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── Deferred mode: Pending documents ── */}
            {!isLive && pendingDocuments && pendingDocuments.length > 0 && (
                <div className="space-y-2">
                    {pendingDocuments.map((d) => (
                        <div
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate text-sm">
                                    {d.type.toUpperCase()} {d.number}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {d.file ? d.file.name : "No file attached"}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {d.expiry
                                    ? getExpiryBadge(d.expiry.toISOString().split("T")[0])
                                    : <Badge variant="outline">No expiry set</Badge>}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Remove"
                                    type="button"
                                    onClick={() => handleRemovePending(d.id)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VehicleDocumentsSection;
