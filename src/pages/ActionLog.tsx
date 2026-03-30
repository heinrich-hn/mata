import Layout from '@/components/Layout';
import ActionItemDetails from '@/components/operations/ActionItemDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_ITEM_PRIORITIES, ACTION_ITEM_STATUSES, ADMIN_USERS, RESPONSIBLE_PERSONS } from '@/constants/actionItems';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOperations } from '@/contexts/OperationsContext';
import { ActionItem, ActionItemComment } from '@/types/operations';
import { formatDate } from 'date-fns';
import jsPDF from 'jspdf';
import {
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
  const _summary = useMemo(() => {
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
      const { isOverdue: _isOverdue, overdueBy: _overdueBy, ...cleanItem } = item as unknown as Record<string, unknown>;
      await updateActionItem({
        ...cleanItem,
        ...updates
      } as ActionItem);

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
      const { isOverdue: _isOverdue, overdueBy: _overdueBy, ...cleanItem } = item as unknown as Record<string, unknown>;
      await updateActionItem({
        ...cleanItem,
        comments: [...(item.comments || []), newComment]
      } as ActionItem);

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
      const { isOverdue: _isOverdue, overdueBy: _overdueBy, ...cleanItem } = item as unknown as Record<string, unknown>;
      await updateActionItem({
        ...cleanItem,
        assigned_to: newUser,
      } as ActionItem);
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

  // Export comprehensive per-person PDF with all details
  const exportToPdf = () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - 2 * margin;

    const generatedOn = formatDate(new Date(), 'PPpp');

    const addFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Car Craft Co • Action Log Report • Generated: ${generatedOn}`,
        margin, pageHeight - 8
      );
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    // Group items by person
    const itemsByPerson: Record<string, typeof enhancedActionItems> = {};
    for (const item of enhancedActionItems) {
      const person = item.assigned_to || 'Unassigned';
      if (!itemsByPerson[person]) itemsByPerson[person] = [];
      itemsByPerson[person].push(item);
    }
    const persons = Object.keys(itemsByPerson).sort();

    let isFirstPerson = true;

    persons.forEach(person => {
      if (!isFirstPerson) doc.addPage();
      isFirstPerson = false;

      let yPos = 15;

      // Title bar
      doc.setFillColor(30, 58, 95);
      doc.rect(margin, yPos, contentWidth, 14, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`ACTION LOG — ${person.toUpperCase()}`, pageWidth / 2, yPos + 10, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPos += 18;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${generatedOn}`, pageWidth / 2, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPos += 8;

      // Person summary box
      const personItems = itemsByPerson[person];
      const pOpen = personItems.filter(i => i.status === 'open').length;
      const pInProgress = personItems.filter(i => i.status === 'in_progress').length;
      const pCompleted = personItems.filter(i => i.status === 'completed').length;
      const pOverdue = personItems.filter(i => i.isOverdue).length;

      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'F');
      doc.setFontSize(9);
      const boxY = yPos + 9;
      const cw = contentWidth / 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Total:', margin + 5, boxY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(personItems.length), margin + 22, boxY);

      doc.setFont('helvetica', 'bold');
      doc.text('Open:', margin + cw, boxY);
      doc.setTextColor(234, 179, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(String(pOpen), margin + cw + 18, boxY);
      doc.setTextColor(0, 0, 0);

      doc.setFont('helvetica', 'bold');
      doc.text('In Progress:', margin + 2 * cw, boxY);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'normal');
      doc.text(String(pInProgress), margin + 2 * cw + 35, boxY);
      doc.setTextColor(0, 0, 0);

      doc.setFont('helvetica', 'bold');
      doc.text('Completed:', margin + 3 * cw, boxY);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'normal');
      doc.text(String(pCompleted), margin + 3 * cw + 33, boxY);
      doc.setTextColor(0, 0, 0);

      doc.setFont('helvetica', 'bold');
      doc.text('Overdue:', margin + 4 * cw, boxY);
      if (pOverdue > 0) doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'normal');
      doc.text(String(pOverdue), margin + 4 * cw + 27, boxY);
      doc.setTextColor(0, 0, 0);

      yPos += 20;

      // Sort: overdue first, then open, in_progress, completed, cancelled
      const statusOrder: Record<string, number> = { open: 0, in_progress: 1, completed: 2, cancelled: 3 };
      const sorted = [...personItems].sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      });

      sorted.forEach((item, itemIdx) => {
        // Check if we need a new page (need ~40mm minimum for one item)
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 15;
        }

        // Item card background
        const isCompleted = item.status === 'completed' || item.status === 'cancelled';
        const isOverdue = item.isOverdue;

        // Item number + title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');

        // Status colour bar
        if (isOverdue) {
          doc.setFillColor(254, 242, 242);
          doc.setDrawColor(239, 68, 68);
        } else if (isCompleted) {
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(34, 197, 94);
        } else {
          doc.setFillColor(249, 250, 251);
          doc.setDrawColor(209, 213, 219);
        }

        // Draw item header bar
        doc.rect(margin, yPos, contentWidth, 8, 'FD');
        doc.setDrawColor(0, 0, 0);

        doc.setTextColor(0, 0, 0);
        const titleText = `${itemIdx + 1}. ${item.title}`;
        const truncatedTitle = titleText.length > 70 ? titleText.substring(0, 67) + '...' : titleText;
        doc.text(truncatedTitle, margin + 3, yPos + 6);

        // Status + Priority badges on right
        doc.setFontSize(7);
        const statusLabel = getStatusLabel(item.status);
        const priorityLabel = getPriorityLabel(item.priority);
        const rightText = `${priorityLabel} | ${statusLabel}${isOverdue ? ` | OVERDUE (${item.overdueBy}d)` : ''}`;

        if (isOverdue) doc.setTextColor(239, 68, 68);
        else if (item.status === 'completed') doc.setTextColor(34, 197, 94);
        else if (item.status === 'in_progress') doc.setTextColor(59, 130, 246);
        else doc.setTextColor(100, 100, 100);

        doc.setFont('helvetica', 'bold');
        doc.text(rightText, pageWidth - margin - 3, yPos + 6, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        yPos += 10;

        // Meta line
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const metaParts = [];
        if (item.due_date) metaParts.push(`Due: ${formatDate(new Date(item.due_date), 'dd MMM yyyy')}`);
        if (item.completed_date) metaParts.push(`Completed: ${formatDate(new Date(item.completed_date), 'dd MMM yyyy')}`);
        if (item.category) metaParts.push(`Category: ${item.category}`);
        if (item.created_by) metaParts.push(`Created by: ${item.created_by}`);
        if (metaParts.length > 0) {
          doc.text(metaParts.join('  •  '), margin + 3, yPos);
          yPos += 5;
        }
        doc.setTextColor(0, 0, 0);

        // Description
        if (item.description) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          const descLines = doc.splitTextToSize(item.description, contentWidth - 6);
          const maxDescLines = 6;
          const linesToRender = descLines.slice(0, maxDescLines);

          if (yPos + linesToRender.length * 4 > pageHeight - 30) {
            doc.addPage();
            yPos = 15;
          }

          doc.text(linesToRender, margin + 3, yPos);
          yPos += linesToRender.length * 4;
          if (descLines.length > maxDescLines) {
            doc.setTextColor(100, 100, 100);
            doc.text('...continued', margin + 3, yPos);
            doc.setTextColor(0, 0, 0);
            yPos += 4;
          }
          yPos += 2;
        }

        // Comments
        const comments = item.comments || [];
        if (comments.length > 0) {
          if (yPos + 10 > pageHeight - 30) {
            doc.addPage();
            yPos = 15;
          }

          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(59, 130, 246);
          doc.text(`Comments (${comments.length})`, margin + 3, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 4;

          comments.forEach(comment => {
            if (yPos > pageHeight - 25) {
              doc.addPage();
              yPos = 15;
            }

            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            const commentDate = comment.created_at ? formatDate(new Date(comment.created_at), 'dd MMM yyyy') : '';
            doc.text(`${comment.created_by} (${commentDate}):`, margin + 6, yPos);
            yPos += 3.5;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const commentLines = doc.splitTextToSize(comment.comment, contentWidth - 12);
            const maxCommentLines = 3;
            doc.text(commentLines.slice(0, maxCommentLines), margin + 6, yPos);
            yPos += Math.min(commentLines.length, maxCommentLines) * 3.5 + 2;
          });
        }

        // Separator
        yPos += 2;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, yPos, margin + contentWidth, yPos);
        yPos += 4;
      });
    });

    // Add footers to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i, pageCount);
    }

    doc.save(`action_log_by_person_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(`Exported action items for ${persons.length} people to PDF`);
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