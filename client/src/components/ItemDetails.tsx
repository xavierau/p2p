import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface ItemDetailsProps {
    isOpen: boolean;
    onClose: () => void;
    itemName: string;
}

const itemMetric = {
    frequency: [
        { name: 'Jan', count: 10 },
        { name: 'Feb', count: 12 },
        { name: 'Mar', count: 8 },
        { name: 'Apr', count: 15 },
    ],
    averageAmount: [
        { name: 'Jan', amount: 50 },
        { name: 'Feb', amount: 55 },
        { name: 'Mar', amount: 48 },
        { name: 'Apr', amount: 60 },
    ],
    quantity: [
        { name: 'Jan', qty: 100 },
        { name: 'Feb', qty: 120 },
        { name: 'Mar', qty: 90 },
        { name: 'Apr', qty: 150 },
    ],
    priceTrend: [
        { name: 'Jan', price: 5 },
        { name: 'Feb', price: 5.2 },
        { name: 'Mar', price: 5.1 },
        { name: 'Apr', price: 5.3 },
    ],
};

const ItemDetails: React.FC<ItemDetailsProps> = ({
    isOpen,
    onClose,
    itemName,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{itemName} - Item Level Metrics</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Frequency</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={itemMetric.frequency}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="count" stroke="#8884d8" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Average Amount</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={itemMetric.averageAmount}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="amount" stroke="#82ca9d" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Quantity</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={itemMetric.quantity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="qty" stroke="#ffc658" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Price Trend</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={itemMetric.priceTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="price" stroke="#ff8042" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemDetails;
