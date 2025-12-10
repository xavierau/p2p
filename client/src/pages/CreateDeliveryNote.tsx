import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import DeliveryNoteForm from '@/components/delivery-notes/DeliveryNoteForm';

/**
 * Page for creating a new delivery note.
 */
const CreateDeliveryNote: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="outline"
            onClick={() => navigate('/delivery-notes')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Delivery Notes
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            Create Delivery Note
          </h1>
          <p className="text-muted-foreground mt-1">
            Record the receipt of goods from a purchase order
          </p>
        </div>
      </div>

      {/* Form */}
      <DeliveryNoteForm onCancel={() => navigate('/delivery-notes')} />
    </div>
  );
};

export default CreateDeliveryNote;
