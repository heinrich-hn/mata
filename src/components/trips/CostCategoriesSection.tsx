import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    type CostCategory,
    type CostSubcategory,
    useAddCostCategory,
    useAddCostSubcategory,
    useCostCategories,
    useDeleteCostCategory,
    useDeleteCostSubcategory,
    useUpdateCostCategory,
    useUpdateCostSubcategory,
} from '@/hooks/useCostCategories';
import {
    ChevronDown,
    ChevronRight,
    Edit2,
    FolderTree,
    Loader2,
    Plus,
    Trash2,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

type EditTarget =
    | { kind: 'category'; category: CostCategory }
    | { kind: 'subcategory'; category: CostCategory; sub: CostSubcategory };

type DeleteTarget =
    | { kind: 'category'; category: CostCategory }
    | { kind: 'subcategory'; category: CostCategory; sub: CostSubcategory };

type AddTarget =
    | { kind: 'category' }
    | { kind: 'subcategory'; category: CostCategory };

const CostCategoriesSection = () => {
    const { toast } = useToast();
    const { data: categories = [], isLoading } = useCostCategories();

    const addCatMutation = useAddCostCategory();
    const updateCatMutation = useUpdateCostCategory();
    const deleteCatMutation = useDeleteCostCategory();
    const addSubMutation = useAddCostSubcategory();
    const updateSubMutation = useUpdateCostSubcategory();
    const deleteSubMutation = useDeleteCostSubcategory();

    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
    const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [nameInput, setNameInput] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return categories;
        const q = search.toLowerCase();
        return categories
            .map((c) => {
                const matchesCat = c.name.toLowerCase().includes(q);
                const matchingSubs = c.subcategories.filter((s) =>
                    s.name.toLowerCase().includes(q),
                );
                if (matchesCat) return c;
                if (matchingSubs.length > 0) return { ...c, subcategories: matchingSubs };
                return null;
            })
            .filter((x): x is CostCategory => x !== null);
    }, [categories, search]);

    const toggleExpanded = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isDefaultCat = (c: CostCategory) => c.id.startsWith('default-');
    const isDefaultSub = (s: CostSubcategory) => s.id.startsWith('default-');

    const openAddCategory = () => {
        setAddTarget({ kind: 'category' });
        setNameInput('');
    };

    const openAddSubcategory = (category: CostCategory) => {
        if (isDefaultCat(category)) {
            toast({
                title: 'Read-only',
                description: 'Add this category as a custom entry first to enable editing its sub-categories.',
                variant: 'destructive',
            });
            return;
        }
        setAddTarget({ kind: 'subcategory', category });
        setNameInput('');
    };

    const openEdit = (target: EditTarget) => {
        setEditTarget(target);
        setNameInput(target.kind === 'category' ? target.category.name : target.sub.name);
    };

    const handleSubmitAdd = async () => {
        const name = nameInput.trim();
        if (!name) {
            toast({ title: 'Validation', description: 'Name is required', variant: 'destructive' });
            return;
        }
        if (!addTarget) return;
        try {
            if (addTarget.kind === 'category') {
                await addCatMutation.mutateAsync({ name, sort_order: categories.length + 1 });
            } else {
                await addSubMutation.mutateAsync({
                    category_id: addTarget.category.id,
                    name,
                    sort_order: addTarget.category.subcategories.length + 1,
                });
                setExpanded((p) => new Set(p).add(addTarget.category.id));
            }
            setAddTarget(null);
        } catch {
            // Toast handled by mutation hooks
        }
    };

    const handleSubmitEdit = async () => {
        const name = nameInput.trim();
        if (!name) {
            toast({ title: 'Validation', description: 'Name is required', variant: 'destructive' });
            return;
        }
        if (!editTarget) return;
        try {
            if (editTarget.kind === 'category') {
                await updateCatMutation.mutateAsync({ id: editTarget.category.id, name });
            } else {
                await updateSubMutation.mutateAsync({ id: editTarget.sub.id, name });
            }
            setEditTarget(null);
        } catch {
            // Toast handled by mutation hooks
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.kind === 'category') {
                await deleteCatMutation.mutateAsync(deleteTarget.category.id);
            } else {
                await deleteSubMutation.mutateAsync(deleteTarget.sub.id);
            }
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FolderTree className="h-4 w-4" />
                                Cost & Expense Categories
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage the categories and sub-categories shown in trip cost and expense forms.
                                Existing entries that reference renamed or deleted items continue to display their original label.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search categories..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-[220px]"
                            />
                            <Button size="sm" onClick={openAddCategory} className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Add Category
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading categories...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {search ? 'No categories match your search.' : 'No categories yet.'}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filtered.map((cat) => {
                                const isExpanded = expanded.has(cat.id);
                                const isDefault = isDefaultCat(cat);
                                return (
                                    <Fragment key={cat.id}>
                                        <div className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-muted/40">
                                            <button
                                                onClick={() => toggleExpanded(cat.id)}
                                                className="flex items-center gap-2 flex-1 text-left"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="font-medium text-sm">{cat.name}</span>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {cat.subcategories.length}
                                                </Badge>
                                                {isDefault && (
                                                    <Badge variant="secondary" className="text-[10px] uppercase">
                                                        Default
                                                    </Badge>
                                                )}
                                            </button>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openAddSubcategory(cat)}
                                                    className="h-8 px-2 text-xs"
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                                    Sub
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit({ kind: 'category', category: cat })}
                                                    disabled={isDefault}
                                                    className="h-8 px-2"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDeleteTarget({ kind: 'category', category: cat })
                                                    }
                                                    disabled={isDefault}
                                                    className="h-8 px-2 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="bg-muted/20 px-4 py-2">
                                                {cat.subcategories.length === 0 ? (
                                                    <div className="px-6 py-3 text-xs text-muted-foreground">
                                                        No sub-categories. Click "Sub" to add one.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        {cat.subcategories.map((sub) => {
                                                            const subDefault = isDefaultSub(sub);
                                                            return (
                                                                <div
                                                                    key={sub.id}
                                                                    className="flex items-center justify-between gap-2 pl-8 pr-2 py-1.5 rounded hover:bg-background"
                                                                >
                                                                    <span className="text-sm">{sub.name}</span>
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                openEdit({
                                                                                    kind: 'subcategory',
                                                                                    category: cat,
                                                                                    sub,
                                                                                })
                                                                            }
                                                                            disabled={subDefault}
                                                                            className="h-7 px-2"
                                                                        >
                                                                            <Edit2 className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                setDeleteTarget({
                                                                                    kind: 'subcategory',
                                                                                    category: cat,
                                                                                    sub,
                                                                                })
                                                                            }
                                                                            disabled={subDefault}
                                                                            className="h-7 px-2 text-destructive hover:text-destructive"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add dialog */}
            <Dialog open={!!addTarget} onOpenChange={(v) => !v && setAddTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {addTarget?.kind === 'subcategory'
                                ? `Add Sub-category to ${addTarget.category.name}`
                                : 'Add Cost Category'}
                        </DialogTitle>
                        <DialogDescription>
                            {addTarget?.kind === 'subcategory'
                                ? 'This sub-category will appear in trip cost and expense pickers under its parent.'
                                : 'New top-level category for organising trip costs and expenses.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="cat-name">Name</Label>
                        <Input
                            id="cat-name"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="e.g. Yard Storage"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSubmitAdd();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitAdd}
                            disabled={addCatMutation.isPending || addSubMutation.isPending}
                        >
                            {(addCatMutation.isPending || addSubMutation.isPending) && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editTarget?.kind === 'subcategory'
                                ? `Edit Sub-category (${editTarget.category.name})`
                                : 'Edit Cost Category'}
                        </DialogTitle>
                        <DialogDescription>
                            Renaming only affects new entries going forward. Existing cost entries keep their original label.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                            id="edit-name"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSubmitEdit();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitEdit}
                            disabled={updateCatMutation.isPending || updateSubMutation.isPending}
                        >
                            {(updateCatMutation.isPending || updateSubMutation.isPending) && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete{' '}
                            {deleteTarget?.kind === 'subcategory' ? 'sub-category' : 'category'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.kind === 'category' ? (
                                <>
                                    This will hide <strong>{deleteTarget.category.name}</strong> and its{' '}
                                    {deleteTarget.category.subcategories.length} sub-category(ies) from new
                                    cost entry forms. Existing cost entries are not changed.
                                </>
                            ) : deleteTarget?.kind === 'subcategory' ? (
                                <>
                                    This will hide <strong>{deleteTarget.sub.name}</strong> from new cost
                                    entry forms. Existing entries are not changed.
                                </>
                            ) : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {(deleteCatMutation.isPending || deleteSubMutation.isPending)
                                ? 'Deleting...'
                                : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CostCategoriesSection;
