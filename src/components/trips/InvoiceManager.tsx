import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, CheckCircle, FileText, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Invoice {
  id: string;
  trip_id: string;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  sent_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes?: string | null;
  created_at: string;
  trips?: {
    trip_number: string;
    client_name: string;
  };
}

interface InvoiceManagerProps {
  onRefresh?: () => void;
}

const InvoiceManager = ({ onRefresh: _onRefresh }: InvoiceManagerProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        trips:trip_id (
          trip_number,
          client_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
      return;
    }

    setInvoices((data || []) as unknown as Invoice[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getStatusBadge = (status: Invoice['status']) => {
    const variants: Record<Invoice['status'], { variant: 'secondary' | 'default' | 'destructive' | 'outline'; icon: LucideIcon }> = {
      draft: { variant: 'secondary', icon: FileText },
      sent: { variant: 'default', icon: Send },
      paid: { variant: 'default', icon: CheckCircle },
      overdue: { variant: 'destructive', icon: AlertCircle },
      cancelled: { variant: 'outline', icon: AlertCircle },
    };

    const { variant, icon: Icon } = variants[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading invoices...</div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-4">
            No invoices yet. Invoices will appear here after trips are completed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Invoices</h2>
        <Badge variant="outline">{invoices.length} Total</Badge>
      </div>

      <div className="grid gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{invoice.invoice_number}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoice.trips?.trip_number} • {invoice.trips?.client_name}
                  </p>
                </div>
                {getStatusBadge(invoice.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </p>
                </div>
                {invoice.sent_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sent Date</p>
                    <p className="font-medium">
                      {new Date(invoice.sent_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {invoice.paid_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Date</p>
                    <p className="font-medium">
                      {new Date(invoice.paid_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              {invoice.payment_reference && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Payment Reference</p>
                  <p className="font-medium">{invoice.payment_reference}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InvoiceManager;