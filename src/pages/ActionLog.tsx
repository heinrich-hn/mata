import Layout from '@/components/Layout';
import ActionItemDetails from '@/components/operations/ActionItemDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_ITEM_PRIORITIES, ACTION_ITEM_STATUSES, ADMIN_USERS, RESPONSIBLE_PERSONS } from '@/constants/actionItems';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOperations } from '@/contexts/OperationsContext';
import { ActionItem, ActionItemComment } from '@/types/operations';
import { formatDate } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  Save,
  Trash2,
  User,
  UserCog,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ActionLog = () => {
  const { userName } = useAuth();
  const { actionItems, addActionItem, updateActionItem, deleteActionItem } = useOperations();

  const [activeTab, setActiveTab] = useState(ADMIN_USERS[0] as string);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    assignedTo: 'all',
    priority: 'all',
    overdue: false
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as ActionItem['priority'],
    category: '',
    dueDate: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate overdue status and days for each action item
  const enhancedActionItems = useMemo(() => {
    return actionItems.map(item => {
      const today = new Date();
      const dueDate = item.due_date ? new Date(item.due_date) : null;
      const isOverdue = dueDate && today > dueDate && item.status !== 'completed' && item.status !== 'cancelled';
      const overdueBy = isOverdue && dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (86400000)) : 0;

      return {
        ...item,
        isOverdue,
        overdueBy
      };
    });
  }, [actionItems]);

  // Apply tab + filters
  const filteredItems = useMemo(() => {
    return enhancedActionItems.filter(item => {
      // Tab filter — always scoped to a user
      if (item.assigned_to !== activeTab) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.assignedTo !== 'all' && item.assigned_to !== filters.assignedTo) return false;
      if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
      if (filters.overdue && !item.isOverdue) return false;
      return true;
    });
  }, [enhancedActionItems, filters, activeTab]);

  // Count items per admin tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const user of ADMIN_USERS) {
      counts[user] = enhancedActionItems.filter(i => i.assigned_to === user).length;
    }
    return counts;
  }, [enhancedActionItems]);

  // Sort items: incomplete first, then by due date
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // Completed/cancelled items at the bottom
      if ((a.status === 'completed' || a.status === 'cancelled') &&
        b.status !== 'completed' && b.status !== 'cancelled') return 1;
      if ((b.status === 'completed' || b.status === 'cancelled') &&
        a.status !== 'completed' && a.status !== 'cancelled') return -1;

      // Sort by overdue first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      // Then by due date
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [filteredItems]);

  // Calculate summary statistics (scoped to active tab)
  const summary = useMemo(() => {
    const items = enhancedActionItems.filter(i => i.assigned_to === activeTab);
    const total = items.length;
    const completed = items.filter(item => item.status === 'completed').length;
    const inProgress = items.filter(item => item.status === 'in_progress').length;
    const open = items.filter(item => item.status === 'open').length;
    const overdue = items.filter(item => item.isOverdue).length;

    return {
      total,
      completed,
      inProgress,
      open,
      overdue,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }, [enhancedActionItems, activeTab]);

  // Handle form changes
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.assignedTo) newErrors.assignedTo = 'Assigned person is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';

    // Validate due date is not in the past
    if (formData.dueDate) {
      const dueDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        newErrors.dueDate = 'Due date cannot be in the past';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await addActionItem({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        assigned_to: formData.assignedTo,
        priority: formData.priority,
        category: formData.category.trim() || undefined,
        due_date: formData.dueDate,
        status: 'open',
        created_by: userName || 'Unknown User',
        comments: []
      });

      toast.success('Action item created successfully');
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      toast.error('Failed to create action item');
      console.error(error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      category: '',
      dueDate: ''
    });
    setErrors({});
  };

  // Handle status change
  const handleStatusChange = async (item: ActionItem, newStatus: ActionItem['status']) => {
    try {
      const updates: Partial<ActionItem> = {
        status: newStatus
      };

      // If marking as completed, add completion date
      if (newStatus === 'completed') {
        updates.completed_date = new Date().toISOString().split('T')[0];
      }

      // Strip computed fields before sending to DB
      const { isOverdue, overdueBy, ...cleanItem } = item as any;
      await updateActionItem({
        ...cleanItem,
        ...updates
      });

      toast.success(`Action item marked as ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update action item');
      console.error(error);
    }
  };

  // Handle add comment
  const handleAddComment = async (item: ActionItem, commentText: string) => {
    try {
      const newComment: ActionItemComment = {
        id: crypto.randomUUID(),
        action_item_id: item.id,
        comment: commentText,
        created_by: userName || 'Unknown User',
        created_at: new Date().toISOString()
      };

      // Strip computed fields before sending to DB
      const { isOverdue, overdueBy, ...cleanItem } = item as any;
      await updateActionItem({
        ...cleanItem,
        comments: [...(item.comments || []), newComment]
      });

      toast.success('Comment added successfully');

      // Refresh selected item if details modal is open
      if (selectedItem?.id === item.id) {
        setSelectedItem({
          ...item,
          comments: [...(item.comments || []), newComment]
        });
      }
    } catch (error) {
      toast.error('Failed to add comment');
      console.error(error);
    }
  };

  // Handle reassign to admin user
  const handleReassign = async (item: ActionItem & { isOverdue?: boolean; overdueBy?: number }, newUser: string) => {
    try {
      // Strip computed fields before sending to DB
      const { isOverdue, overdueBy, ...cleanItem } = item as any;
      await updateActionItem({
        ...cleanItem,
        assigned_to: newUser,
      });
      toast.success(`Reassigned to ${newUser}`);
    } catch (error) {
      toast.error('Failed to reassign action item');
      console.error(error);
    }
  };

  // Handle delete action item
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this action item? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteActionItem(id);
      toast.success('Action item deleted successfully');
    } catch (error) {
      toast.error('Failed to delete action item');
      console.error(error);
    }
  };

  // Handle view details
  const handleViewDetails = (item: ActionItem) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  // Get status badge class
  const getStatusBadgeClass = (status: ActionItem['status']) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success';
      case 'in_progress': return 'bg-primary/10 text-primary';
      case 'cancelled': return 'bg-muted text-muted-foreground';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const getStatusLabel = (status: ActionItem['status']) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return 'Open';
    }
  };

  const getPriorityLabel = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'urgent': return 'Urgent';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return priority;
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const headers = [
      'Title',
      'Description',
      'Status',
      'Priority',
      'Assigned To',
      'Category',
      'Due Date',
      'Completed Date',
      'Created By',
      'Created At',
      'Overdue',
      'Days Overdue',
      'Comments Count'
    ].join('\t');

    const rows = sortedItems.map(item => {
      const enhancedItem = enhancedActionItems.find(e => e.id === item.id);
      return [
        item.title,
        (item.description || '').replace(/[\t\n\r]/g, ' '),
        getStatusLabel(item.status),
        getPriorityLabel(item.priority),
        item.assigned_to || '',
        item.category || '',
        item.due_date || '',
        item.completed_date || '',
        item.created_by || '',
        item.created_at ? formatDate(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : '',
        enhancedItem?.isOverdue ? 'Yes' : 'No',
        enhancedItem?.overdueBy || 0,
        (item.comments || []).length
      ].join('\t');
    });

    const tsvContent = '\uFEFF' + headers + '\n' + rows.join('\n');
    const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `action_log_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();

    toast.success(`Exported ${sortedItems.length} action items to Excel`);
  };

  // Export to PDF
  const exportToPdf = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Action Log Report', pageWidth / 2, 15, { align: 'center' });

    // Subtitle with date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${formatDate(new Date(), 'PPpp')}`, pageWidth / 2, 22, { align: 'center' });

    // Summary stats
    doc.setFontSize(9);
    const summaryText = `Total: ${summary.total} | Open: ${summary.open} | In Progress: ${summary.inProgress} | Completed: ${summary.completed} | Overdue: ${summary.overdue}`;
    doc.text(summaryText, pageWidth / 2, 28, { align: 'center' });

    // Table data
    const tableHeaders = [
      'Title',
      'Status',
      'Priority',
      'Assigned To',
      'Due Date',
      'Overdue',
      'Category'
    ];

    const tableData = sortedItems.map(item => {
      const enhancedItem = enhancedActionItems.find(e => e.id === item.id);
      return [
        item.title.length > 40 ? item.title.substring(0, 37) + '...' : item.title,
        getStatusLabel(item.status),
        getPriorityLabel(item.priority),
        item.assigned_to || '-',
        item.due_date ? formatDate(new Date(item.due_date), 'dd MMM yyyy') : '-',
        enhancedItem?.isOverdue ? `Yes (${enhancedItem.overdueBy}d)` : 'No',
        item.category || '-'
      ];
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 33,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 35 },
        4: { cellWidth: 28 },
        5: { cellWidth: 25 },
        6: { cellWidth: 35 },
      },
      didParseCell: (data) => {
        // Color-code status column
        if (data.section === 'body' && data.column.index === 1) {
          const status = data.cell.raw as string;
          if (status === 'Completed') {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (status === 'In Progress') {
            data.cell.styles.textColor = [59, 130, 246];
          } else if (status === 'Open') {
            data.cell.styles.textColor = [234, 179, 8];
          }
        }
        // Color-code priority column
        if (data.section === 'body' && data.column.index === 2) {
          const priority = data.cell.raw as string;
          if (priority === 'Urgent') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          } else if (priority === 'High') {
            data.cell.styles.textColor = [249, 115, 22];
          }
        }
        // Color-code overdue column
        if (data.section === 'body' && data.column.index === 5) {
          const overdue = data.cell.raw as string;
          if (overdue.startsWith('Yes')) {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`action_log_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(`Exported ${sortedItems.length} action items to PDF`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdf}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, assignedTo: activeTab }));
              setShowAddModal(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Action Item
            </Button>
          </div>
        </div>

        {/* User Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1">
            {ADMIN_USERS.map(user => (
              <TabsTrigger key={user} value={user} className="flex-1 min-w-[100px]">
                {user} {tabCounts[user] > 0 && `(${tabCounts[user]})`}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader title="Filter Action Items" />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {ACTION_ITEM_STATUSES.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assigned To</Label>
                <Select value={filters.assignedTo} onValueChange={(value) => setFilters(prev => ({ ...prev, assignedTo: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Persons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Persons</SelectItem>
                    {RESPONSIBLE_PERSONS.map(person => (
                      <SelectItem key={person} value={person}>{person}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {ACTION_ITEM_PRIORITIES.map(priority => (
                      <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ status: 'all', assignedTo: 'all', priority: 'all', overdue: false })}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Items List */}
        <Card>
          <CardHeader
            title={`Action Items (${filteredItems.length})`}
          />
          <CardContent>
            {sortedItems.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No action items found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Object.values(filters).some(f => f) ? 'No items match your filters.' : 'Start by adding your first action item.'}
                </p>
                {!Object.values(filters).some(f => f) && (
                  <div className="mt-6">
                    <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Action Item
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${item.status === 'completed' ? 'bg-success/5 border-success/20' :
                      item.isOverdue ? 'bg-destructive/5 border-l-4 border-l-destructive' :
                        'bg-card border-border'
                      }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-medium truncate">{item.title}</h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          {item.isOverdue && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive">
                              Overdue by {item.overdueBy} days
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Assigned:</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="inline-flex items-center gap-1 font-medium truncate hover:underline cursor-pointer">
                                  {item.assigned_to || 'Unassigned'}
                                  <UserCog className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {ADMIN_USERS.map(user => (
                                  <DropdownMenuItem
                                    key={user}
                                    disabled={item.assigned_to === user}
                                    onClick={() => handleReassign(item, user)}
                                  >
                                    <User className="w-3 h-3 mr-2" />
                                    {user}
                                    {item.assigned_to === user && (
                                      <CheckCircle className="w-3 h-3 ml-auto text-green-500" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {item.due_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Due:</span>
                              <span className={`font-medium ${item.isOverdue ? 'text-destructive' : ''}`}>
                                {formatDate(new Date(item.due_date), 'PP')}
                              </span>
                            </div>
                          )}
                          {item.category && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Category:</span>
                              <span className="font-medium truncate">{item.category}</span>
                            </div>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleViewDetails(item)}>
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <UserCog className="w-3 h-3 mr-1" />
                              Reassign
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {ADMIN_USERS.map(user => (
                              <DropdownMenuItem
                                key={user}
                                disabled={item.assigned_to === user}
                                onClick={() => handleReassign(item, user)}
                              >
                                <User className="w-3 h-3 mr-2" />
                                {user}
                                {item.assigned_to === user && (
                                  <CheckCircle className="w-3 h-3 ml-auto text-green-500" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {item.status !== 'completed' && item.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(item, item.status === 'open' ? 'in_progress' : 'completed')}
                          >
                            {item.status === 'open' ? (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Start
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Complete
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Action Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { resetForm(); setShowAddModal(false); }}
        title="Add Action Item"
        maxWidth="lg"
      >
        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/10 rounded-md p-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h4 className="text-sm font-medium">Action Item Tracking</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a new action item to track tasks, assign responsibility, and monitor progress.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="Enter action item title..."
              />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Provide details about the action item..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assignedTo">Assigned To *</Label>
                <Select value={formData.assignedTo} onValueChange={(value) => handleFormChange('assignedTo', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSIBLE_PERSONS.map(person => (
                      <SelectItem key={person} value={person}>{person}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignedTo && <p className="text-sm text-destructive mt-1">{errors.assignedTo}</p>}
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date *</Label>
                <DatePicker
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(date) => handleFormChange('dueDate', date ? date.toISOString().split('T')[0] : '')}
                  minDate={new Date()}
                  placeholder="Select due date"
                />
                {errors.dueDate && <p className="text-sm text-destructive mt-1">{errors.dueDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleFormChange('priority', value as ActionItem['priority'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_ITEM_PRIORITIES.map(priority => (
                      <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  placeholder="Optional category..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { resetForm(); setShowAddModal(false); }}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              <Save className="w-4 h-4 mr-2" />
              Create Action Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* Action Item Details Modal */}
      {selectedItem && (
        <ActionItemDetails
          isOpen={showDetailsModal}
          onClose={() => { setSelectedItem(null); setShowDetailsModal(false); }}
          actionItem={selectedItem}
          onStatusChange={handleStatusChange}
          onAddComment={handleAddComment}
        />
      )}
    </Layout>
  );
};

export default ActionLog;