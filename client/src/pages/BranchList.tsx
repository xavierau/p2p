import React, { useEffect, useState } from 'react';
import { branchService, Branch } from '@/services/branchService';
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

const BranchList: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [newBranchName, setNewBranchName] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const data = await branchService.getBranches();
            setBranches(data);
        } catch (error) {
            console.error('Failed to fetch branches', error);
        }
    };

    const handleCreateBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await branchService.createBranch({ name: newBranchName });
            setNewBranchName('');
            setIsDialogOpen(false);
            fetchBranches();
        } catch (error) {
            console.error('Failed to create branch', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div/>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Add Branch</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Branch</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new branch here.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateBranch}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={newBranchName}
                                        onChange={(e) => setNewBranchName(e.target.value)}
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
                        {branches.map((branch) => (
                            <TableRow key={branch.id}>
                                <TableCell>{branch.id}</TableCell>
                                <TableCell className="font-medium">{branch.name}</TableCell>
                            </TableRow>
                        ))}
                        {branches.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                    No branches found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default BranchList;