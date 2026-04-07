import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    DOCUMENT_CATEGORIES,
    useClientDocuments,
    useDeleteClientDocument,
    useUploadClientDocument,
    type ClientDocument,
    type DocumentCategory,
} from '@/hooks/useClientDocuments';
import { useClientLoads } from '@/hooks/useClientLoads';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
    Download,
    File,
    FileImage,
    FileSpreadsheet,
    FileText,
    Filter,
    Loader2,
    Package,
    Trash2,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function getCategoryLabel(category: string): string {
    return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
        price_list: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        git_invoice: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
        pod: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
        contract: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        statement: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
        other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return colors[category] ?? colors.other;
}

function getFileIcon(mimeType: string | null, fileName: string) {
    if (mimeType?.startsWith('image/'))
        return <FileImage className="h-5 w-5 text-pink-500" />;
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf'))
        return <FileText className="h-5 w-5 text-red-500" />;
    if (
        mimeType?.includes('spreadsheet') ||
        mimeType?.includes('excel') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.csv')
    )
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDocumentsPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const { data: documents = [], isLoading } = useClientDocuments(clientId);
    const { data: loads = [] } = useClientLoads(clientId);
    const uploadMutation = useUploadClientDocument();
    const deleteMutation = useDeleteClientDocument();

    // Filters
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Upload form state
    const [showUpload, setShowUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('other');
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadLoadId, setUploadLoadId] = useState<string>('');
    const [uploadNotes, setUploadNotes] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredDocs = useMemo(() => {
        if (categoryFilter === 'all') return documents;
        return documents.filter((d) => d.category === categoryFilter);
    }, [documents, categoryFilter]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            alert('File size must be under 25 MB');
            return;
        }
        setSelectedFile(file);
        if (!uploadTitle) {
            setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
        }
    };

    const handleUpload = () => {
        if (!selectedFile || !clientId || !uploadTitle.trim()) return;

        uploadMutation.mutate(
            {
                clientId,
                file: selectedFile,
                category: uploadCategory,
                title: uploadTitle.trim(),
                loadId: uploadLoadId && uploadLoadId !== 'none' ? uploadLoadId : null,
                notes: uploadNotes.trim() || null,
            },
            {
                onSuccess: () => {
                    setSelectedFile(null);
                    setUploadTitle('');
                    setUploadCategory('other');
                    setUploadLoadId('');
                    setUploadNotes('');
                    setShowUpload(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                },
            }
        );
    };

    const handleDelete = (doc: ClientDocument) => {
        if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
        deleteMutation.mutate(doc);
    };

    const handleDownload = (doc: ClientDocument) => {
        window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-6">
            {/* Header with upload toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Shared files, invoices, and documents
                    </p>
                </div>
                <Button onClick={() => setShowUpload(!showUpload)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Document
                </Button>
            </div>

            {/* Upload Form */}
            {showUpload && (
                <Card className="border-primary/20 shadow-sm">
                    <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Upload className="h-4 w-4 text-primary" />
                            Upload New Document
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* File input */}
                            <div className="sm:col-span-2">
                                <Label htmlFor="doc-file">File</Label>
                                <Input
                                    id="doc-file"
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp"
                                    onChange={handleFileSelect}
                                    className="mt-1.5"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Max 25 MB. PDF, Office docs, images, CSV.</p>
                            </div>

                            {/* Title */}
                            <div>
                                <Label htmlFor="doc-title">Title</Label>
                                <Input
                                    id="doc-title"
                                    placeholder="e.g. March 2026 Price List"
                                    value={uploadTitle}
                                    onChange={(e) => setUploadTitle(e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <Label>Category</Label>
                                <Select
                                    value={uploadCategory}
                                    onValueChange={(v) => setUploadCategory(v as DocumentCategory)}
                                >
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Linked Load (optional) */}
                            <div>
                                <Label>Linked Load (optional)</Label>
                                <Select
                                    value={uploadLoadId || 'none'}
                                    onValueChange={setUploadLoadId}
                                >
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="None — client-level document" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {loads.map((load) => (
                                            <SelectItem key={load.id} value={load.id}>
                                                {load.load_id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Notes */}
                            <div>
                                <Label htmlFor="doc-notes">Notes (optional)</Label>
                                <Textarea
                                    id="doc-notes"
                                    placeholder="Any additional notes..."
                                    value={uploadNotes}
                                    onChange={(e) => setUploadNotes(e.target.value)}
                                    className="mt-1.5 min-h-[60px]"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                onClick={handleUpload}
                                disabled={!selectedFile || !uploadTitle.trim() || uploadMutation.isPending}
                                className="gap-2"
                            >
                                {uploadMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        Upload
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowUpload(false);
                                    setSelectedFile(null);
                                    setUploadTitle('');
                                    setUploadNotes('');
                                    setUploadLoadId('');
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <button
                    onClick={() => setCategoryFilter('all')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap',
                        categoryFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                >
                    All ({documents.length})
                </button>
                {DOCUMENT_CATEGORIES.map((cat) => {
                    const count = documents.filter((d) => d.category === cat.value).length;
                    if (count === 0) return null;
                    return (
                        <button
                            key={cat.value}
                            onClick={() => setCategoryFilter(cat.value)}
                            className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap',
                                categoryFilter === cat.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                        >
                            {cat.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Documents List */}
            <Card className="border-subtle shadow-sm">
                <CardHeader className="border-b border-subtle bg-card/70 py-4 px-5">
                    <CardTitle className="text-sm font-semibold tracking-tight">
                        {filteredDocs.length} {filteredDocs.length === 1 ? 'Document' : 'Documents'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-5 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-4 rounded-2xl bg-muted/50">
                                <File className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                            <p className="mt-4 text-sm font-medium text-foreground">No documents yet</p>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                                {categoryFilter !== 'all'
                                    ? 'No documents in this category. Try a different filter.'
                                    : 'Upload documents to share with this client.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {filteredDocs.map((doc) => (
                                <DocumentRow
                                    key={doc.id}
                                    doc={doc}
                                    loads={loads}
                                    onDownload={handleDownload}
                                    onDelete={handleDelete}
                                    isDeleting={deleteMutation.isPending}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function DocumentRow({
    doc,
    loads,
    onDownload,
    onDelete,
    isDeleting,
}: {
    doc: ClientDocument;
    loads: { id: string; load_id: string }[];
    onDownload: (doc: ClientDocument) => void;
    onDelete: (doc: ClientDocument) => void;
    isDeleting: boolean;
}) {
    const linkedLoad = doc.load_id ? loads.find((l) => l.id === doc.load_id) : null;

    return (
        <div className="px-5 py-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-4">
                {/* File Icon */}
                <div className="p-2.5 rounded-xl bg-muted/50 flex-shrink-0 mt-0.5">
                    {getFileIcon(doc.mime_type, doc.file_name)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{doc.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <Badge
                                    variant="secondary"
                                    className={cn('text-[10px] font-medium px-2 py-0.5', getCategoryColor(doc.category))}
                                >
                                    {getCategoryLabel(doc.category)}
                                </Badge>
                                {linkedLoad && (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1">
                                        <Package className="h-3 w-3" />
                                        {linkedLoad.load_id}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDownload(doc)}
                                className="h-8 px-3 gap-1.5 text-xs"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Download</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(doc)}
                                disabled={isDeleting}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>{doc.file_name}</span>
                        {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                        <span>
                            {(() => {
                                try {
                                    return format(parseISO(doc.created_at), 'dd MMM yyyy');
                                } catch {
                                    return '';
                                }
                            })()}
                        </span>
                        {doc.uploaded_by && <span>by {doc.uploaded_by}</span>}
                    </div>

                    {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{doc.notes}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
