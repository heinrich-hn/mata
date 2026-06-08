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
  Plus
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
          <Badge variant="destructive" className="text-[10px] font-semibold uppercase px-1.5 py-0 h-5 gap-1">
            <ShieldAlert className="w-3 h-3" />
            Expired
          </Badge>
        );
      case 'expiring':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0 h-5 gap-1 text-amber-600 border-amber-400 bg-amber-50">
            <AlertTriangle className="w-3 h-3" />
            Expiring Soon
          </Badge>
        );
      case 'valid':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0 h-5 gap-1 text-emerald-600 border-emerald-400 bg-emerald-50">
            <CheckCircle className="w-3 h-3" />
            Valid
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0 h-5 gap-1 text-muted-foreground bg-muted/50 border-muted">
            No Date
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading driver documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Documents & Certificates
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage required qualifications and licenses
          </p>
        </div>
        {documents.length > 0 && (
          <Badge variant="secondary" className="font-medium">
            {documents.filter(d => d.expiry_date).length} / {DOCUMENT_TYPES.length} tracked
          </Badge>
        )}
      </div>

      <div className={compact ? 'space-y-3' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
        {DOCUMENT_TYPES.map((docType) => {
          const doc = getDocument(docType.value);
          const isEditing = editingType === docType.value;
          const tracked = isDocTypeActive(docType.value);

          return (
            <Card 
              key={docType.value} 
              className={`
                relative transition-all duration-200 overflow-hidden flex flex-col h-full
                ${isEditing ? 'ring-2 ring-primary border-primary shadow-md' : ''} 
                ${!tracked && !isEditing ? 'bg-muted/30 border-dashed opacity-80 hover:opacity-100' : 'hover:shadow-md'}
              `}
            >
              <CardContent className="p-0 flex flex-col flex-grow">
                {isEditing ? (
                  /* Edit Mode */
                  <div className="flex flex-col flex-grow bg-primary/5 p-4">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-primary/10">
                      <h4 className="font-semibold text-sm text-primary">{docType.label}</h4>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-black/5" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 flex-grow">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Expiry Date</Label>
                        <Input
                          type="date"
                          value={editExpiryDate}
                          onChange={(e) => setEditExpiryDate(e.target.value)}
                          className="h-9 text-sm bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Document Number</Label>
                        <Input
                          value={editDocNumber}
                          onChange={(e) => setEditDocNumber(e.target.value)}
                          placeholder="e.g. LIC-12345"
                          className="h-9 text-sm bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Attachment</Label>
                        <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-lg p-3 bg-background hover:bg-muted/50 transition-colors text-center">
                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileSelect}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          {!previewUrl && !selectedFile && !doc?.file_url && (
                            <div className="pointer-events-none flex flex-col items-center gap-1 text-muted-foreground">
                              <Upload className="h-5 w-5 mb-1 opacity-50" />
                              <span className="text-xs font-medium">Click to upload or drag & drop</span>
                              <span className="text-[10px] opacity-70">PDF, JPG, PNG up to 10MB</span>
                            </div>
                          )}
                          
                          {previewUrl && (
                            <div className="relative rounded-md overflow-hidden bg-black/5 border">
                              <img src={previewUrl} alt="Preview" className="w-full h-28 object-contain" />
                            </div>
                          )}
                          
                          {!previewUrl && selectedFile && (
                            <div className="flex flex-col items-center justify-center py-2 text-primary">
                              <FileText className="h-6 w-6 mb-2" />
                              <p className="text-xs font-medium truncate max-w-[180px]">{selectedFile.name}</p>
                            </div>
                          )}
                          
                          {!selectedFile && doc?.file_url && (
                            <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
                              <FileText className="h-6 w-6 mb-2" />
                              <p className="text-xs font-medium truncate max-w-[180px]">Keep existing: {doc.file_name || 'File'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-5 mt-auto">
                      <Button size="sm" variant="outline" className="flex-1 h-9" onClick={cancelEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1 h-9" onClick={handleSave} disabled={isUpserting}>
                        {isUpserting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex flex-col h-full p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1.5">
                        <h4 className="font-semibold text-sm leading-none text-foreground">{docType.shortLabel}</h4>
                        {tracked ? getExpiryBadge(doc?.expiry_date || null) : (
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">Not Tracked</span>
                        )}
                      </div>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center">
                              <Switch
                                checked={tracked}
                                onCheckedChange={(v) => toggleDocTypeActive(docType.value, v)}
                                disabled={isUpdatingActive}
                                className="data-[state=checked]:bg-primary"
                                aria-label={`Track ${docType.shortLabel}`}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">
                              {tracked ? 'Tracking active' : 'Enable tracking'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="space-y-3 flex-grow">
                      <div className="grid grid-cols-[16px_1fr] items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground/70" />
                        <span className={!doc?.expiry_date ? "text-muted-foreground italic text-xs" : "font-medium"}>
                          {formatDate(doc?.expiry_date || null)}
                        </span>
                      </div>
                      
                      {doc?.document_number && (
                        <div className="grid grid-cols-[16px_1fr] items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground/70" />
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded-md w-fit">
                            {doc.document_number}
                          </span>
                        </div>
                      )}

                      {doc?.file_url ? (
                        <div className="bg-secondary/40 rounded-md p-2 flex items-center gap-2 mt-2">
                          <div className="bg-primary/10 p-1.5 rounded text-primary">
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium truncate flex-grow text-foreground/80">
                            {doc.file_name || 'Document attached'}
                          </span>
                        </div>
                      ) : (
                         <div className="text-xs text-muted-foreground italic mt-2 opacity-70">
                           No document attached
                         </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs font-medium bg-secondary hover:bg-secondary/80"
                        onClick={() => startEdit(docType.value)}
                      >
                        {doc ? <Upload className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                        {doc ? 'Update' : 'Add Info'}
                      </Button>

                      <div className="flex items-center gap-1">
                        {doc?.file_url && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => window.open(doc.file_url!, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">View Document</p>
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
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(docType.value)}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Delete Record</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
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