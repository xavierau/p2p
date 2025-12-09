import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { itemService } from '@/services/itemService';
import { vendorService } from '@/services/vendorService';
import type { Item, ItemPriceHistory, Vendor, UpdateItemInput } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem as SelectItemUI,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

/**
 * Format a number as USD currency
 */
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

/**
 * Format date for chart display
 */
const formatChartDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Loading spinner component
 */
const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

/**
 * Error message component with retry functionality
 */
const ErrorMessage: React.FC<{ message: string; onRetry: () => void }> = ({
    message,
    onRetry,
}) => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-destructive text-lg">{message}</div>
        <Button onClick={onRetry}>Retry</Button>
    </div>
);

/**
 * Edit Item Dialog Component
 * Handles form state and validation for editing item details
 */
interface EditItemDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    item: Item;
    vendors: Vendor[];
    onSave: (data: UpdateItemInput) => Promise<void>;
    isSaving: boolean;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
    isOpen,
    onOpenChange,
    item,
    vendors,
    onSave,
    isSaving,
}) => {
    const [formData, setFormData] = useState({
        name: item.name,
        item_code: item.item_code || '',
        price: String(item.price),
        vendorId: String(item.vendorId),
    });

    // Reset form when dialog opens with fresh item data
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: item.name,
                item_code: item.item_code || '',
                price: String(item.price),
                vendorId: String(item.vendorId),
            });
        }
    }, [isOpen, item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            name: formData.name,
            item_code: formData.item_code || undefined,
            price: parseFloat(formData.price),
            vendorId: parseInt(formData.vendorId, 10),
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                    <DialogDescription>
                        Update the item details below.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                    }))
                                }
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-item-code" className="text-right">
                                Item Code
                            </Label>
                            <Input
                                id="edit-item-code"
                                value={formData.item_code}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        item_code: e.target.value,
                                    }))
                                }
                                className="col-span-3"
                                placeholder="Optional"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-price" className="text-right">
                                Price
                            </Label>
                            <Input
                                id="edit-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        price: e.target.value,
                                    }))
                                }
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-vendor" className="text-right">
                                Vendor
                            </Label>
                            <Select
                                value={formData.vendorId}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        vendorId: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors.map((vendor) => (
                                        <SelectItemUI
                                            key={vendor.id}
                                            value={String(vendor.id)}
                                        >
                                            {vendor.name}
                                        </SelectItemUI>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Delete Confirmation Dialog Component
 */
interface DeleteConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    itemName: string;
    onConfirm: () => Promise<void>;
    isDeleting: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    isOpen,
    onOpenChange,
    itemName,
    onConfirm,
    isDeleting,
}) => {
    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Item</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete "{itemName}"? This action
                        cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Price History Chart Component
 */
interface PriceHistoryChartProps {
    priceHistory: ItemPriceHistory[];
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ priceHistory }) => {
    if (priceHistory.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No price history available
            </div>
        );
    }

    // Sort by date and format for chart
    const chartData = [...priceHistory]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((entry) => ({
            date: formatChartDate(entry.date),
            price: entry.price,
            fullDate: new Date(entry.date).toLocaleDateString(),
        }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                    tickFormatter={(value) =>
                        new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        }).format(value)
                    }
                />
                <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Price']}
                    labelFormatter={(_, payload) => {
                        if (payload && payload[0]) {
                            return `Date: ${payload[0].payload.fullDate}`;
                        }
                        return '';
                    }}
                />
                <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                    name="Price"
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

/**
 * ItemDetail Page Component
 * Displays item information, price history chart, and provides edit/delete functionality
 */
const ItemDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Data state
    const [item, setItem] = useState<Item | null>(null);
    const [priceHistory, setPriceHistory] = useState<ItemPriceHistory[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    /**
     * Fetch item data and price history
     */
    const fetchItemData = useCallback(async () => {
        if (!id) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch item with included price history
            const itemData = await itemService.getItemById(Number(id));
            setItem(itemData);
            setPriceHistory(itemData.priceHistory || []);
        } catch (err) {
            console.error('Failed to load item details:', err);
            setError('Failed to load item details. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    /**
     * Fetch vendors for the edit form
     */
    const fetchVendors = useCallback(async () => {
        try {
            const response = await vendorService.getVendors();
            setVendors(response.data);
        } catch (err) {
            console.error('Failed to fetch vendors:', err);
        }
    }, []);

    // Fetch data on mount and when id changes
    useEffect(() => {
        fetchItemData();
        fetchVendors();
    }, [fetchItemData, fetchVendors]);

    /**
     * Handle item update
     */
    const handleSave = async (data: UpdateItemInput) => {
        if (!id) return;

        setIsSaving(true);
        try {
            const updatedItem = await itemService.updateItem(Number(id), data);
            setItem(updatedItem);
            setIsEditDialogOpen(false);
            // Refresh to get updated price history if price changed
            await fetchItemData();
        } catch (err) {
            console.error('Failed to update item:', err);
            // Keep dialog open on error
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Handle item deletion
     */
    const handleDelete = async () => {
        if (!id) return;

        setIsDeleting(true);
        try {
            await itemService.deleteItem(Number(id));
            navigate('/items');
        } catch (err) {
            console.error('Failed to delete item:', err);
            setIsDeleting(false);
        }
    };

    /**
     * Navigate back to items list
     */
    const handleBack = () => {
        navigate('/items');
    };

    // Loading state
    if (isLoading) {
        return <LoadingSpinner />;
    }

    // Error state
    if (error) {
        return <ErrorMessage message={error} onRetry={fetchItemData} />;
    }

    // Item not found
    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="text-muted-foreground text-lg">Item not found</div>
                <Button onClick={handleBack}>Back to Items</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back button */}
            <Button variant="outline" onClick={handleBack}>
                Back to Items
            </Button>

            {/* Item Information Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>{item.name}</CardTitle>
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(true)}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteDialogOpen(true)}
                        >
                            Delete
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-muted-foreground">
                                Item Code
                            </dt>
                            <dd className="text-lg">
                                {item.item_code || 'N/A'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-muted-foreground">
                                Price
                            </dt>
                            <dd className="text-lg font-semibold">
                                {formatCurrency(item.price)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-muted-foreground">
                                Vendor
                            </dt>
                            <dd className="text-lg">
                                {item.vendor ? (
                                    <Link
                                        to={`/vendors/${item.vendorId}`}
                                        className="text-primary hover:underline"
                                    >
                                        {item.vendor.name}
                                    </Link>
                                ) : (
                                    'Unknown Vendor'
                                )}
                            </dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            {/* Price History Chart Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Price History</CardTitle>
                </CardHeader>
                <CardContent>
                    <PriceHistoryChart priceHistory={priceHistory} />
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <EditItemDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                item={item}
                vendors={vendors}
                onSave={handleSave}
                isSaving={isSaving}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                itemName={item.name}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default ItemDetail;
