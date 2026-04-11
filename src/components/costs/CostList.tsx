import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import type { Cost } from '@/types/forms';
import { Download, Edit, Eye, FileText, Flag, Trash2 } from 'lucide-react';

interface CostAttachment {
  id: string;
  filename: string;
  file_url: string;
}

interface CostWithAttachments extends Cost {
  attachments?: CostAttachment[];
}

interface CostListProps {
  costs: CostWithAttachments[];
  onEdit?: (cost: CostWithAttachments) => void;
  onDelete?: (id: string) => void;
}

export const CostList = ({ costs, onEdit, onDelete }: CostListProps) => {
  if (costs.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium">No cost entries</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add cost entries to track expenses for this trip.
        </p>
      </div>
    );
  }

  const handleViewAttachment = (url: string) => {
    if (url) window.open(url, '_blank');
  };

  const handleDownloadAttachment = (url: string, filename: string) => {
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `attachment-${new Date().getTime()}`;
      document.body.appendChild(link);
      link.click();
      // Remove link safely
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
    }
  };

  const systemCosts = costs.filter(cost => cost.is_system_generated);
  const manualCosts = costs.filter(cost => !cost.is_system_generated);

  return (
    <div className="space-y-6">
      {manualCosts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Manual Cost Entries ({manualCosts.length})</h3>
          {manualCosts.map((cost) => (
            <Card key={cost.id} className={cost.is_flagged ? 'border-l-4 border-l-warning' : ''}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <div>
                          <h4 className="font-medium">{cost.category}</h4>
                          <p className="text-sm text-muted-foreground">{cost.sub_category}</p>
                        </div>
                        {cost.is_flagged && (
                          <Badge variant="outline" className="border-warning text-warning">
                            <Flag className="w-3 h-3 mr-1" />
                            Flagged
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatCurrency(cost.amount, cost.currency as string)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(cost.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground">Ref: {cost.reference_number}</p>
                    </div>

                    {cost.notes && (
                      <p className="text-sm text-muted-foreground mb-3">{cost.notes}</p>
                    )}

                    {cost.attachments && cost.attachments.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Attachments:</p>
                        <div className="flex flex-wrap gap-2">
                          {cost.attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center space-x-2 bg-muted px-2 py-1 rounded text-sm">
                              <span className="text-muted-foreground">{attachment.filename}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewAttachment(attachment.file_url)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadAttachment(attachment.file_url, attachment.filename)}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 ml-4">
                    {onEdit && (
                      <Button size="sm" variant="outline" onClick={() => onEdit(cost)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button size="sm" variant="outline" onClick={() => onDelete(cost.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {systemCosts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">System Cost Entries ({systemCosts.length})</h3>
          {systemCosts.map((cost) => (
            <Card key={cost.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{cost.category}</h4>
                        <p className="text-sm text-muted-foreground">{cost.sub_category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatCurrency(cost.amount, cost.currency as string)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(cost.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {cost.notes && (
                      <p className="text-sm text-muted-foreground">{cost.notes}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};