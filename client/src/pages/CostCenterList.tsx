import React, { useEffect, useState } from 'react';
import { costCenterService, CostCenter } from '@/services/costCenterService';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
    DialogTrigger,
} from '@/components/ui/dialog';

const CostCenterList: React.FC = () => {
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [newCostCenterName, setNewCostCenterName] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        fetchCostCenters();
    }, []);

    const fetchCostCenters = async () => {
        try {
            const data = await costCenterService.getCostCenters();
            setCostCenters(data);
        } catch (error) {
            console.error('Failed to fetch cost centers', error);
        }
    };

    const handleCreateCostCenter = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await costCenterService.createCostCenter({ name: newCostCenterName });
            setNewCostCenterName('');
            setIsDialogOpen(false);
            fetchCostCenters();
        } catch (error) {
            console.error('Failed to create cost center', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div/>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Add Cost Center</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Cost Center</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new cost center here.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateCostCenter}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={newCostCenterName}
                                        onChange={(e) => setNewCostCenterName(e.target.value)}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Save changes</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costCenters.map((costCenter) => (
                            <TableRow key={costCenter.id}>
                                <TableCell>{costCenter.id}</TableCell>
                                <TableCell className="font-medium">{costCenter.name}</TableCell>
                            </TableRow>
                        ))}
                        {costCenters.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                    No cost centers found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default CostCenterList;