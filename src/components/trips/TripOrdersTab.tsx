import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import {
    Download,
    FileText,
    Image as ImageIcon,
    Loader2,
    Package,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react';
import { format } from 'date-fns';

interface TripOrder {
    id: string;
    trip_id: string;
    order_number: string;
    description: string | null;
    created_by: string | null;
    created_at: string;
}

interface TripOrderDocument {
    id: string;
    trip_order_id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
    file_type: string | null;
    uploaded_by: string | null;
    uploaded_at: string;
}

const BUCKET = 'trip-documents';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = 'application/pdf,image/*';

const formatBytes = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface TripOrdersTabProps {
    tripId: string;
}

const TripOrdersTab = ({ tripId }: TripOrdersTabProps) => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newOrderNumber, setNewOrderNumber] = useState('');
    const [newOrderDescription, setNewOrderDescription] = useState('');
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
    const [orderToDelete, setOrderToDelete] = useState<TripOrder | null>(null);

    // Cast client to bypass strict typing for tables not yet in generated types.
    // Run `npx supabase gen types typescript ...` after migration to remove this.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Orders for this trip
    const { data: orders = [], isLoading: ordersLoading } = useQuery<TripOrder[]>({
        queryKey: ['trip-orders', tripId],
        queryFn: async () => {
            const { data, error } = await db
                .from('trip_orders')
                .select('*')
                .eq('trip_id', tripId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []) as TripOrder[];
        },
        enabled: !!tripId,
    });

    // All documents across the trip's orders (single fetch for performance)
    const orderIds = orders.map((o) => o.id);
    const { data: documents = [] } = useQuery<TripOrderDocument[]>({
        queryKey: ['trip-order-documents', tripId, orderIds.join(',')],
        queryFn: async () => {
            if (orderIds.length === 0) return [];
            const { data, error } = await db
                .from('trip_order_documents')
                .select('*')
                .in('trip_order_id', orderIds)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return (data || []) as TripOrderDocument[];
        },
        enabled: orderIds.length > 0,
    });

    const documentsByOrder = documents.reduce<Record<string, TripOrderDocument[]>>((acc, doc) => {
        (acc[doc.trip_order_id] ||= []).push(doc);
        return acc;
    }, {});

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trip-order-documents', tripId] });
    };

    const handleCreateOrder = async () => {
        if (!newOrderNumber.trim()) {
            toast({ title: 'Order number required', variant: 'destructive' });
            return;
        }
        setIsSubmittingOrder(true);
        try {
            const { error } = await db.from('trip_orders').insert({
                trip_id: tripId,
                order_number: newOrderNumber.trim(),
                description: newOrderDescription.trim() || null,
                created_by: userName || null,
            });
            if (error) throw error;
            toast({ title: 'Order added' });
            setNewOrderNumber('');
            setNewOrderDescription('');
            setIsAddOpen(false);
            refresh();
        } catch (err) {
            toast({
                title: 'Failed to add order',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const handleUpload = useCallback(
        async (orderId: string, files: FileList | null) => {
            if (!files || files.length === 0) return;
            setUploadingOrderId(orderId);
            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file.size > MAX_FILE_SIZE) {
                        toast({
                            title: 'File too large',
                            description: `${file.name} exceeds 25 MB limit`,
                            variant: 'destructive',
                        });
                        continue;
                    }

                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filePath = `orders/${tripId}/${orderId}/${Date.now()}_${i}_${safeName}`;

                    const { error: uploadError } = await supabase.storage
                        .from(BUCKET)
                        .upload(filePath, file, {
                            contentType: file.type || undefined,
                            upsert: false,
                        });
                    if (uploadError) throw uploadError;

                    const { error: dbError } = await db.from('trip_order_documents').insert({
                        trip_order_id: orderId,
                        file_name: file.name,
                        file_path: filePath,
                        file_size: file.size,
                        file_type: file.type || null,
                        uploaded_by: userName || null,
                    });
                    if (dbError) throw dbError;
                }
                toast({ title: 'Upload complete' });
                queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] });
                queryClient.invalidateQueries({ queryKey: ['trip-order-documents', tripId] });
            } catch (err) {
                toast({
                    title: 'Upload failed',
                    description: err instanceof Error ? err.message : 'Unknown error',
                    variant: 'destructive',
                });
            } finally {
                setUploadingOrderId(null);
            }
        },
        [tripId, userName, toast, queryClient, db]
    );

    const handleDownload = async (doc: TripOrderDocument) => {
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(doc.file_path, 60 * 5);
            if (error) throw error;
            window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            toast({
                title: 'Download failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteDocument = async (doc: TripOrderDocument) => {
        setDeletingDocId(doc.id);
        try {
            const { error: storageError } = await supabase.storage
                .from(BUCKET)
                .remove([doc.file_path]);
            if (storageError) {
                // Continue to remove DB row even if storage delete fails (file may be missing)
                console.warn('Storage delete error:', storageError.message);
            }
            const { error: dbError } = await db
                .from('trip_order_documents')
                .delete()
                .eq('id', doc.id);
            if (dbError) throw dbError;
            toast({ title: 'Document deleted' });
            refresh();
        } catch (err) {
            toast({
                title: 'Delete failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setDeletingDocId(null);
        }
    };

    const handleDeleteOrder = async () => {
        if (!orderToDelete) return;
        try {
            const orderDocs = documentsByOrder[orderToDelete.id] || [];
            if (orderDocs.length > 0) {
                await supabase.storage
                    .from(BUCKET)
                    .remove(orderDocs.map((d) => d.file_path));
            }
            const { error } = await db
                .from('trip_orders')
                .delete()
                .eq('id', orderToDelete.id);
            if (error) throw error;
            toast({ title: 'Order deleted' });
            setOrderToDelete(null);
            refresh();
        } catch (err) {
            toast({
                title: 'Delete failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Orders & Documents
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Upload PDFs and images per order — drivers can download them in the mobile app.
                    </p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Order
                </Button>
            </div>

            {ordersLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
                </div>
            )}

            {!ordersLoading && orders.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        No orders yet. Click <strong>Add Order</strong> to create one.
                    </CardContent>
                </Card>
            )}

            {orders.map((order) => {
                const docs = documentsByOrder[order.id] || [];
                const isUploading = uploadingOrderId === order.id;
                return (
                    <Card key={order.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        Order {order.order_number}
                                        <Badge variant="secondary">{docs.length} file{docs.length === 1 ? '' : 's'}</Badge>
                                    </CardTitle>
                                    {order.description && (
                                        <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Added {format(new Date(order.created_at), 'dd MMM yyyy HH:mm')}
                                        {order.created_by ? ` by ${order.created_by}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <label>
                                        <input
                                            type="file"
                                            accept={ACCEPTED_TYPES}
                                            multiple
                                            className="hidden"
                                            disabled={isUploading}
                                            onChange={(e) => {
                                                handleUpload(order.id, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                        <Button asChild size="sm" variant="outline" disabled={isUploading}>
                                            <span className="cursor-pointer">
                                                {isUploading ? (
                                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Upload className="w-4 h-4 mr-1" />
                                                )}
                                                {isUploading ? 'Uploading…' : 'Upload'}
                                            </span>
                                        </Button>
                                    </label>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setOrderToDelete(order)}
                                        aria-label="Delete order"
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {docs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                            ) : (
                                <ul className="divide-y border rounded-md">
                                    {docs.map((doc) => {
                                        const isImage = (doc.file_type || '').startsWith('image/');
                                        const Icon = isImage ? ImageIcon : FileText;
                                        return (
                                            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                                                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatBytes(doc.file_size)}
                                                        {doc.uploaded_by ? ` • ${doc.uploaded_by}` : ''}
                                                        {' • '}
                                                        {format(new Date(doc.uploaded_at), 'dd MMM yyyy HH:mm')}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDownload(doc)}
                                                    aria-label="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteDocument(doc)}
                                                    disabled={deletingDocId === doc.id}
                                                    aria-label="Delete"
                                                >
                                                    {deletingDocId === doc.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    )}
                                                </Button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {/* Add order dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Order</DialogTitle>
                        <DialogDescription>
                            Create a new order on this trip. You can upload PDFs and images afterwards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="order-number">Order Number</Label>
                            <Input
                                id="order-number"
                                value={newOrderNumber}
                                onChange={(e) => setNewOrderNumber(e.target.value)}
                                placeholder="e.g. PO-12345"
                            />
                        </div>
                        <div>
                            <Label htmlFor="order-description">Description (optional)</Label>
                            <Textarea
                                id="order-description"
                                value={newOrderDescription}
                                onChange={(e) => setNewOrderDescription(e.target.value)}
                                rows={3}
                                placeholder="Customer, cargo, special instructions…"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmittingOrder}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateOrder} disabled={isSubmittingOrder}>
                            {isSubmittingOrder && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete order confirmation */}
            <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete order?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete order
                            {orderToDelete ? ` "${orderToDelete.order_number}"` : ''} and all its uploaded
                            documents. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteOrder}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default TripOrdersTab;
