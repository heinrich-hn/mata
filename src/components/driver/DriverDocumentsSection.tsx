import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveDocumentTypes } from '@/hooks/useActiveDocumentTypes';
import { useDriverDocuments, DOCUMENT_TYPES, type DriverDocumentType } from '@/hooks/useDriverDocuments';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Eye,
  FileText,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface DriverDocumentsSectionProps {
  driverId: string;
  driverName: string;
  compact?: boolean;
}

const DriverDocumentsSection = ({ driverId, driverName: _driverName, compact = false }: DriverDocumentsSectionProps) => {
  const { user } = useAuth();
  const {
    documents,
    isLoading,
    getDocument,
    getExpiryStatus,
    upsertDocument,
    isUpserting,
    deleteDocument,
    isDeleting,
  } = useDriverDocuments(driverId);

  const {
    isActive: isDocTypeActive,
    toggleActive: toggleDocTypeActive,
    isUpdating: isUpdatingActive,
  } = useActiveDocumentTypes('drivers', driverId);

  const [editingType, setEditingType] = useState<DriverDocumentType | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editDocNumber, setEditDocNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((type: DriverDocumentType) => {
    const existing = getDocument(type);
    setEditingType(type);
    setEditExpiryDate(existing?.expiry_date || '');
    setEditDocNumber(existing?.document_number || '');
    setSelectedFile(null);
    setPreviewUrl(null);
  }, [getDocument]);

  const cancelEdit = () => {
    setEditingType(null);
    setEditExpiryDate('');
    setEditDocNumber('');
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSave = async () => {
    if (!editingType) return;

    await upsertDocument({
      driverId,
      documentType: editingType,
      expiryDate: editExpiryDate || null,
      documentNumber: editDocNumber || null,
      file: selectedFile,
      uploadedBy: user?.email || 'admin',
    });

    cancelEdit();
  };

  const handleDelete = async (type: DriverDocumentType) => {
    const doc = getDocument(type);
    if (!doc) return;
    await deleteDocument({ documentId: doc.id, filePath: doc.file_path });
  };

  const getExpiryBadge = (expiryDate: string | null) => {
    const status = getExpiryStatus(expiryDate);
    switch (status) {
      case 'expired':
        return (
          <Badge variant="destructive" className="text-xs gap-1">
            <ShieldAlert className="w-3 h-3" />
            Expired
          </Badge>
        );
      case 'expiring':
        return (
          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-400 bg-amber-50">
            <AlertTriangle className="w-3 h-3" />
            Expiring Soon
          </Badge>
        );
      case 'valid':
        return (
          <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-400 bg-emerald-50">
            <CheckCircle className="w-3 h-3" />
            Valid
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            No Date
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Documents & Certificates
        </h3>
        {documents.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {documents.filter(d => d.expiry_date).length} of {DOCUMENT_TYPES.length} dates set
          </span>
        )}
      </div>

      <div className={compact ? 'space-y-2' : 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'}>
        {DOCUMENT_TYPES.map((docType) => {
          const doc = getDocument(docType.value);
          const isEditing = editingType === docType.value;
          const tracked = isDocTypeActive(docType.value);

          return (
            <Card key={docType.value} className={`relative transition-all ${isEditing ? 'ring-2 ring-primary' : 'hover:shadow-sm'} ${!tracked ? 'opacity-60' : ''}`}>
              <CardContent className="p-3">
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{docType.label}</h4>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Expiry Date</Label>
                        <Input
                          type="date"
                          value={editExpiryDate}
                          onChange={(e) => setEditExpiryDate(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Document Number</Label>
                        <Input
                          value={editDocNumber}
                          onChange={(e) => setEditDocNumber(e.target.value)}
                          placeholder="Optional"
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Upload File</Label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileSelect}
                          className="h-8 text-sm file:mr-2 file:text-xs"
                        />
                        {previewUrl && (
                          <div className="relative mt-1">
                            <img src={previewUrl} alt="Preview" className="w-full h-24 object-cover rounded border" />
                          </div>
                        )}
                        {!previewUrl && selectedFile && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {selectedFile.name}
                          </p>
                        )}
                        {!selectedFile && doc?.file_url && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Current: {doc.file_name || 'Uploaded file'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={isUpserting}>
                        {isUpserting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm">{docType.shortLabel}</h4>
                      <div className="flex items-center gap-2">
                        {tracked && getExpiryBadge(doc?.expiry_date || null)}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center">
                                <Switch
                                  checked={tracked}
                                  onCheckedChange={(v) => toggleDocTypeActive(docType.value, v)}
                                  disabled={isUpdatingActive}
                                  aria-label={`Track ${docType.shortLabel} for alerts`}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">
                                {tracked ? 'Tracked — alerts enabled' : 'Not tracked — alerts disabled'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Expires: {formatDate(doc?.expiry_date || null)}</span>
                      </div>
                      {doc?.document_number && (
                        <p className="text-xs text-muted-foreground font-mono">
                          #{doc.document_number}
                        </p>
                      )}
                      {doc?.file_url && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{doc.file_name || 'File attached'}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 pt-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => startEdit(docType.value)}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">{doc ? 'Update' : 'Add'} {docType.shortLabel}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {doc?.file_url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => window.open(doc.file_url!, '_blank')}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">View File</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {doc && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(docType.value)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">Remove</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DriverDocumentsSection;
