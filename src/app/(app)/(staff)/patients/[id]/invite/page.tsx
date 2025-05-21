'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Constants } from '@/types/supabase';

// Use the actual roles from your Supabase schema
const VALID_ROLES = Constants.public.Enums.user_role;

// Define the Zod schema for the invitation form
const invitationFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  role: z.enum(['patient', 'family_contact', 'case_manager'], {
    required_error: 'Please select a role for the invitation',
  }),
  expiryDays: z.coerce.number().int().min(1).max(30).default(7),
});

// Derive the type from the schema
type InvitationFormValues = z.infer<typeof invitationFormSchema>;

export default function InvitePatientPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const patientId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientDetails, setPatientDetails] = useState<{
    first_name: string;
    last_name: string;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // Fetch patient details to display in the form
    const fetchPatient = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .single();

      if (error) {
        console.error('Error fetching patient:', error);
        toast({
          title: 'Error',
          description: 'Could not load patient details. Please try again.',
          variant: 'destructive',
        });
      } else if (data) {
        setPatientDetails(data);
      }
    };

    fetchPatient();
  }, [patientId, supabase, toast]);

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: '',
      role: 'patient',
      expiryDays: 7,
    },
  });

  const onSubmit: SubmitHandler<InvitationFormValues> = async data => {
    setIsSubmitting(true);

    try {
      // Call the RPC function to create the invitation
      // Using type assertion to handle TypeScript type checking
      const { data: invitationId, error } = await supabase.rpc(
        'invite_patient_portal_access' as any,
        {
          p_patient_id: patientId,
          p_email: data.email,
          p_role: data.role,
          p_expiry_days: data.expiryDays,
        }
      );

      if (error) {
        throw error;
      }

      console.log('Invitation created with ID:', invitationId);

      toast({
        title: 'Invitation Sent',
        description: `Portal invitation has been created and sent to ${data.email}`,
      });

      // Reset form or redirect
      form.reset();
      router.push(`/patients/${patientId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: errorMessage || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patientDetails) {
    return <div className="p-8">Loading patient details...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Invite to Patient Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <p className="text-lg">
              Send portal invitation to{' '}
              <span className="font-semibold">
                {patientDetails.first_name} {patientDetails.last_name}
              </span>
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter recipient's email" {...field} />
                    </FormControl>
                    <FormDescription>
                      The invitation will be sent to this email address.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Roles</SelectLabel>
                          <SelectItem value="patient">Patient (Direct Access)</SelectItem>
                          <SelectItem value="family_contact">Family Member/Caregiver</SelectItem>
                          <SelectItem value="case_manager">Case Manager</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Determines the level of access and relationship to the patient.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry (Days)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={30} {...field} />
                    </FormControl>
                    <FormDescription>
                      Number of days until this invitation expires (1-30).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/patients/${patientId}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
