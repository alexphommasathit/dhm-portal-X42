'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

// Define the schema for the form
const familyMemberSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  relationship: z.string().min(1, { message: 'Relationship is required' }),
  phone: z.string().optional(),
  isEmergencyContact: z.boolean().default(false),
  isDesignatedRepresentative: z.boolean().default(false),
});

type FamilyMemberFormValues = z.infer<typeof familyMemberSchema>;

export default function AddFamilyMemberPage() {
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

  // Define relationship options
  const relationshipOptions = [
    { value: 'spouse', label: 'Spouse/Partner' },
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'friend', label: 'Friend' },
    { value: 'caregiver', label: 'Caregiver' },
    { value: 'other', label: 'Other' },
  ];

  const form = useForm<FamilyMemberFormValues>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      relationship: '',
      phone: '',
      isEmergencyContact: false,
      isDesignatedRepresentative: false,
    },
  });

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

  const onSubmit = async (formData: FamilyMemberFormValues) => {
    setIsSubmitting(true);

    try {
      // Step 1: Create or get the user profile for the family member
      const { data: existingProfiles, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email)
        .limit(1);

      if (profileCheckError) {
        throw new Error(`Error checking existing profile: ${profileCheckError.message}`);
      }

      let familyMemberUserId: string;

      if (existingProfiles && existingProfiles.length > 0) {
        // Use existing profile
        familyMemberUserId = existingProfiles[0].id;
      } else {
        // Create new profile for family member
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone_number: formData.phone || null,
            role: 'family_contact',
          })
          .select('id')
          .single();

        if (createProfileError) {
          throw new Error(`Error creating profile: ${createProfileError.message}`);
        }

        if (!newProfile) {
          throw new Error('Failed to create profile - no ID returned');
        }

        familyMemberUserId = newProfile.id;
      }

      // Step 2: Create the family link
      const { error: linkError } = await supabase.from('patient_family_links').insert({
        patient_id: patientId,
        family_member_user_id: familyMemberUserId,
        relationship: formData.relationship,
        is_emergency_contact: formData.isEmergencyContact,
        is_designated_representative: formData.isDesignatedRepresentative,
        is_active: true,
      });

      if (linkError) {
        throw new Error(`Error creating family link: ${linkError.message}`);
      }

      toast({
        title: 'Success',
        description: 'Family member has been added successfully.',
      });

      // Redirect back to patient page
      router.push(`/patients/${patientId}`);
    } catch (error) {
      console.error('Error adding family member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add family member.',
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
          <CardTitle>Add Family Member</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <p className="text-lg">
              Add a family member or caregiver for{' '}
              <span className="font-semibold">
                {patientDetails.first_name} {patientDetails.last_name}
              </span>
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to Patient</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Relationship</SelectLabel>
                          {relationshipOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isEmergencyContact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Emergency Contact</FormLabel>
                        <FormDescription>
                          Designate this person as an emergency contact
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDesignatedRepresentative"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Designated Representative</FormLabel>
                        <FormDescription>
                          Has legal authority to make decisions (POA)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/patients/${patientId}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Family Member'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
