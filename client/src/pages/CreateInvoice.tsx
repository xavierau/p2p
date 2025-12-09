import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { itemService } from '@/services/itemService';
import { invoiceService } from '@/services/invoiceService';
import type { Item, InvoiceItemInput } from '@/types';

const CreateInvoice: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [selectedItems, setSelectedItems] = useState<InvoiceItemInput[]>([]);
    const [currentItemId, setCurrentItemId] = useState<string>('');
    const [currentQuantity, setCurrentQuantity] = useState<number>(1);
    const [department, setDepartment] = useState('');
    const [project, setProject] = useState('');
    const [costCenter, setCostCenter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const response = await itemService.getItems();
            setItems(response.data);
        } catch (error) {
            console.error('Failed to fetch items', error);
        }
    };

    const handleAddItem = () => {
        if (!currentItemId) return;
        const item = items.find((i) => String(i.id) === currentItemId);
        if (!item) return;

        setSelectedItems([
            ...selectedItems,
            {
                itemId: item.id,
                quantity: currentQuantity,
                price: item.price,
            },
        ]);
        setCurrentItemId('');
        setCurrentQuantity(1);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        setSelectedItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0) return;

        try {
            await invoiceService.createInvoice({
                items: selectedItems,
                project: project || undefined,
            });
            navigate('/invoices');
        } catch (error) {
            console.error('Failed to create invoice', error);
        }
    };

    const calculateTotal = () => {
        return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <Input
                                id="department"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="e.g. Engineering"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project">Project</Label>
                            <Input
                                id="project"
                                value={project}
                                onChange={(e) => setProject(e.target.value)}
                                placeholder="e.g. Q4 Update"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="costCenter">Cost Center</Label>
                            <Input
                                id="costCenter"
                                value={costCenter}
                                onChange={(e) => setCostCenter(e.target.value)}
                                placeholder="e.g. CC-123"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Add Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-7 space-y-2">
                            <Label>Item</Label>
                            <Select value={currentItemId} onValueChange={setCurrentItemId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an item" />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.name} (${item.price})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-3 space-y-2">
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                min="1"
                                value={currentQuantity}
                                onChange={(e) => setCurrentQuantity(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="col-span-2">
                            <Button onClick={handleAddItem} className="w-full" disabled={!currentItemId}>
                                Add
                            </Button>
                        </div>
                    </div>

                    {selectedItems.length > 0 && (
                        <div className="mt-6 border rounded-md p-4">
                            <h3 className="font-semibold mb-4">Selected Items</h3>
                            <div className="space-y-2">
                                {selectedItems.map((item, index) => {
                                    const originalItem = items.find((i) => i.id === item.itemId);
                                    return (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <span>
                                                {originalItem?.name} x {item.quantity}
                                            </span>
                                            <div className="flex items-center gap-4">
                                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive h-auto p-0"
                                                    onClick={() => handleRemoveItem(index)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                                    <span>Total</span>
                                    <span>${calculateTotal().toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleSubmit} className="w-full mt-4" disabled={selectedItems.length === 0}>
                        Create Invoice
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default CreateInvoice;
