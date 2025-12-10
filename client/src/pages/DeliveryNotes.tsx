import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import DeliveryNoteList from '@/components/delivery-notes/DeliveryNoteList';

/**
 * Main delivery notes page with list and navigation.
 */
const DeliveryNotes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage delivery receipts for purchase orders
          </p>
        </div>
        <Button onClick={() => navigate('/delivery-notes/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Delivery Note
        </Button>
      </div>

      {/* Delivery Notes List */}
      <DeliveryNoteList />
    </div>
  );
};

export default DeliveryNotes;
