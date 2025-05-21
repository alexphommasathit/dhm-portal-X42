'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Define the available roles for staff members
// This should ideally come from a shared type or enum, possibly from your RBACContext or Supabase types
// For now, we'll define it here. Ensure these values match your user_role enum in Supabase.
const staffRoles = [
  { value: 'staff', label: 'Staff' },
  { value: 'financial_admin', label: 'Financial Admin' },
  { value: 'clinician', label: 'Clinician' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'hha', label: 'HHA (Home Health Aide)' },
  { value: 'clinical_administrator', label: 'Clinical Administrator' },
];

type StaffRoleValue = (typeof staffRoles)[number]['value'];

const inviteStaffSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  role: z.enum(staffRoles.map(role => role.value) as [StaffRoleValue, ...StaffRoleValue[]], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  jobTitle: z.string().optional(),
});

type InviteStaffFormValues = z.infer<typeof inviteStaffSchema>;

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSent?: () => void; // Optional callback
}

export default function InviteStaffModal({ isOpen, onClose, onInviteSent }: InviteStaffModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InviteStaffFormValues>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: undefined, // Or a default role if you prefer
      jobTitle: '',
    },
  });

  const onSubmit = async (values: InviteStaffFormValues) => {
    setIsSubmitting(true);
    // console.log('Invite staff form submitted:', values);

    try {
      // Implement API call to /api/admin/invite-staff
      const response = await fetch('/api/admin/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation'); // Use errorData.error based on API response
      }

      // Simulate API call success - remove this if using actual API
      // await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${values.email}.`,
      });
      form.reset();
      if (onInviteSent) {
        onInviteSent();
      }
      onClose(); // Close modal on success
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Could not send invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" {...form.register('firstName')} />
            {form.formState.errors.firstName && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" {...form.register('lastName')} />
            {form.formState.errors.lastName && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="jobTitle">Job Title (Optional)</Label>
            <Input id="jobTitle" {...form.register('jobTitle')} />
            {/* No error display for optional field, unless specific validation is added */}
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              onValueChange={value => form.setValue('role', value as StaffRoleValue)}
              defaultValue={form.getValues('role')}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {staffRoles.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.role.message}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
