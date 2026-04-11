import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trip } from '@/types/operations';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, CheckCircle, Save, X } from 'lucide-react';
import React, { useState } from 'react';

interface PaymentUpdateModalProps {
  isOpen: boolean;
  trip: Trip;
  onClose: () => void;
  onUpdatePayment: (tripId: string, paymentData: {
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    paymentAmount?: number;
    paymentReceivedDate?: string;
    paymentNotes?: string;
    paymentMethod?: string;
    bankReference?: string;
  }) => Promise<void>;
}

type PaymentStatus = 'unpaid' | 'partial' | 'paid';
type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'credit_card' | 'mobile_money' | 'other';

// Helper functions
const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
  if (!amount) return `${currency} 0.00`;
  return `${currency} ${amount.toFixed(2)}`;
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return 'N/A';
  return format(new Date(date), 'dd MMM yyyy');
};

const PaymentUpdateModal: React.FC<PaymentUpdateModalProps> = ({
  isOpen,
  trip,
  onClose,
  onUpdatePayment
}) => {
  const [formData, setFormData] = useState({
    paymentStatus: (trip.payment_status || 'unpaid') as PaymentStatus,
    paymentAmount: trip.payment_amount?.toString() || '',
    paymentReceivedDate: trip.payment_received_date || new Date().toISOString().split('T')[0],
    paymentNotes: '',
    paymentMethod: (trip.payment_method || 'bank_transfer') as PaymentMethod,
    bankReference: trip.bank_reference || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setSubmitError(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.paymentStatus !== 'unpaid') {
      const amount = Number(formData.paymentAmount);

      if (!formData.paymentAmount || isNaN(amount) || amount <= 0) {
        newErrors.paymentAmount = 'Payment amount is required and must be greater than 0';
      } else if (amount > (trip.base_revenue || 0)) {
        newErrors.paymentAmount = `Payment amount cannot exceed invoice amount (${formatCurrency(trip.base_revenue, trip.revenue_currency)})`;
      }

      if (!formData.paymentReceivedDate) {
        newErrors.paymentReceivedDate = 'Payment received date is required';
      } else {
        const paymentDate = new Date(formData.paymentReceivedDate);
        const invoiceDate = new Date(trip.invoice_date || new Date());
        const today = new Date();

        if (paymentDate < invoiceDate) {
          newErrors.paymentReceivedDate = 'Payment date cannot be before invoice date';
        }

        if (paymentDate > today) {
          newErrors.paymentReceivedDate = 'Payment date cannot be in the future';
        }
      }

      if (!formData.paymentMethod) {
        newErrors.paymentMethod = 'Payment method is required';
      }

      if (formData.paymentMethod === 'bank_transfer' && !formData.bankReference.trim()) {
        newErrors.bankReference = 'Bank reference is required for bank transfers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const paymentData = {
        paymentStatus: formData.paymentStatus,
        paymentAmount: formData.paymentStatus !== 'unpaid' ? Number(formData.paymentAmount) : undefined,
        paymentReceivedDate: formData.paymentStatus !== 'unpaid' ? formData.paymentReceivedDate : undefined,
        paymentNotes: formData.paymentNotes.trim() || undefined,
        paymentMethod: formData.paymentStatus !== 'unpaid' ? formData.paymentMethod : undefined,
        bankReference: formData.bankReference.trim() || undefined
      };

      await onUpdatePayment(trip.id, paymentData);

      setSubmitSuccess(true);

      setTimeout(() => {
        onClose();
        setSubmitSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Error updating payment:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to update payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateOutstandingAmount = () => {
    const invoiceAmount = trip.base_revenue || 0;
    const paidAmount = Number(formData.paymentAmount) || 0;
    return Math.max(0, invoiceAmount - paidAmount);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      case 'partial': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const agingDays = trip.invoice_due_date ?
    Math.floor((new Date().getTime() - new Date(trip.invoice_due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const isFullPayment = Number(formData.paymentAmount) === (trip.base_revenue || 0);
  const isPartialPayment = Number(formData.paymentAmount) > 0 && Number(formData.paymentAmount) < (trip.base_revenue || 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Payment Status</DialogTitle>
          <DialogDescription>
            Update payment information and status for this invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {submitSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Payment status updated successfully!
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-800">{submitError}</p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Invoice Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p><strong>Invoice #:</strong> {trip.invoice_number || 'N/A'}</p>
                <p><strong>Customer:</strong> {trip.client_name || 'N/A'}</p>
                <p><strong>Invoice Amount:</strong> {formatCurrency(trip.base_revenue, trip.revenue_currency)}</p>
              </div>
              <div>
                <p><strong>Invoice Date:</strong> {formatDate(trip.invoice_date)}</p>
                <p><strong>Due Date:</strong> {formatDate(trip.invoice_due_date)}</p>
                <p>
                  <strong>Aging:</strong>
                  <span className={`ml-1 font-bold ${
                    agingDays > 30 ? 'text-red-600' :
                    agingDays > 0 ? 'text-orange-600' :
                    'text-green-600'
                  }`}>
                    {agingDays} days
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-gray-800 mb-2">Current Payment Status</h4>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getPaymentStatusColor(trip.payment_status || 'unpaid')}`}>
                {(trip.payment_status || 'unpaid').toUpperCase()}
              </span>
              {trip.payment_amount && (
                <span className="text-sm text-gray-600">
                  Paid: {formatCurrency(trip.payment_amount, trip.revenue_currency)}
                </span>
              )}
              {trip.payment_received_date && (
                <span className="text-sm text-gray-600">
                  on {formatDate(trip.payment_received_date)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Update Payment Information</h3>

            <div>
              <Label htmlFor="paymentStatus">Payment Status *</Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(value: PaymentStatus) => handleChange('paymentStatus', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">❌ Unpaid</SelectItem>
                  <SelectItem value="partial">⚠️ Partial Payment</SelectItem>
                  <SelectItem value="paid">✅ Paid in Full</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.paymentStatus !== 'unpaid' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentAmount">Payment Amount ({trip.revenue_currency || 'USD'}) *</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={trip.base_revenue || 0}
                      value={formData.paymentAmount}
                      onChange={(e) => handleChange('paymentAmount', e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                    />
                    {errors.paymentAmount && (
                      <p className="text-sm text-red-600 mt-1">{errors.paymentAmount}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="paymentReceivedDate">Payment Received Date *</Label>
                    <DatePicker
                      id="paymentReceivedDate"
                      value={formData.paymentReceivedDate}
                      onChange={(date) => handleChange('paymentReceivedDate', date ? date.toISOString().split('T')[0] : '')}
                      maxDate={new Date()}
                      minDate={trip.invoice_date ? new Date(trip.invoice_date) : undefined}
                      disabled={isSubmitting}
                      placeholder="Select payment date"
                    />
                    {errors.paymentReceivedDate && (
                      <p className="text-sm text-red-600 mt-1">{errors.paymentReceivedDate}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value: PaymentMethod) => handleChange('paymentMethod', value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                        <SelectItem value="cash">💵 Cash</SelectItem>
                        <SelectItem value="cheque">📝 Cheque</SelectItem>
                        <SelectItem value="credit_card">💳 Credit Card</SelectItem>
                        <SelectItem value="mobile_money">📱 Mobile Money</SelectItem>
                        <SelectItem value="other">🔄 Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.paymentMethod && (
                      <p className="text-sm text-red-600 mt-1">{errors.paymentMethod}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="bankReference">
                      {formData.paymentMethod === 'bank_transfer' ? 'Bank Reference / Transaction ID *' : 'Reference / Transaction ID'}
                    </Label>
                    <Input
                      id="bankReference"
                      value={formData.bankReference}
                      onChange={(e) => handleChange('bankReference', e.target.value)}
                      placeholder="e.g., TXN123456789"
                      disabled={isSubmitting}
                    />
                    {errors.bankReference && (
                      <p className="text-sm text-red-600 mt-1">{errors.bankReference}</p>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Payment Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-green-600">Invoice Amount</p>
                      <p className="font-bold text-green-800">
                        {formatCurrency(trip.base_revenue, trip.revenue_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">Payment Amount</p>
                      <p className="font-bold text-green-800">
                        {formatCurrency(Number(formData.paymentAmount) || 0, trip.revenue_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">Outstanding</p>
                      <p className={`font-bold ${calculateOutstandingAmount() === 0 ? 'text-green-800' : 'text-orange-800'}`}>
                        {formatCurrency(calculateOutstandingAmount(), trip.revenue_currency)}
                      </p>
                    </div>
                  </div>
                </div>

                {isFullPayment && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Payment in Full - Invoice will be marked as PAID
                      </span>
                    </div>
                  </div>
                )}

                {isPartialPayment && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        Partial Payment - Outstanding amount: {formatCurrency(calculateOutstandingAmount(), trip.revenue_currency)}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <Label htmlFor="paymentNotes">Payment Notes</Label>
              <Textarea
                id="paymentNotes"
                value={formData.paymentNotes}
                onChange={(e) => handleChange('paymentNotes', e.target.value)}
                placeholder="Add any notes about this payment (e.g., late payment reason, payment terms, special arrangements, etc.)..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || submitSuccess}
            >
              {isSubmitting ? (
                'Updating...'
              ) : submitSuccess ? (
                'Updated!'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update Payment Status
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentUpdateModal;