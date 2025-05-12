'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Calendar, FileText, Mail, User, UserPlus, Check, X } from 'lucide-react';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { useRBAC } from '@/context/RBACContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender_id: number | null;
  phone_number: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  zip_postal_code: string | null;
  country: string;
  is_active: boolean;
  patient_status_id: number;
  middle_name?: string | null;
  preferred_name?: string | null;
  suffix?: string | null;
  preferred_language?: string | null;
  mobile_phone_number?: string | null;
  race?: string | null;
  ethnicity?: string | null;
  marital_status?: string | null;
  sexual_orientation?: string | null;
  sex_assigned_at_birth?: string | null;
  previous_name?: string | null;
  social_security_number?: string | null;
  branch?: string | null;
  preferred_contact_method?: string | null;
}

// Define interface for the RPC return structure
interface FamilyLinkRpcResult {
  link_id: string;
  relationship: string;
  is_active: boolean;
  is_emergency_contact: boolean;
  is_designated_representative: boolean;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_role: string | null; // Role is cast to TEXT in the function
  profile_email: string | null; // Added for displaying email
  profile_phone: string | null; // Added to match RPC output
}

// Define schema for address form
const addressFormSchema = z.object({
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state_province: z.string().nullable().optional(),
  zip_postal_code: z.string().nullable().optional(),
});

type AddressFormValues = z.infer<typeof addressFormSchema>;

// Define schema for family member form
const familyMemberSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  relationship: z.string().min(1, { message: 'Relationship is required' }),
  phone: z.string().optional(),
  isEmergencyContact: z.boolean(),
  isDesignatedRepresentative: z.boolean(),
});

type FamilyMemberFormValues = z.infer<typeof familyMemberSchema>;

// Add a patient status interface
interface PatientStatus {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { canAccess } = useRBAC();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for Portal Access tab - use the RPC result type
  const [familyLinks, setFamilyLinks] = useState<FamilyLinkRpcResult[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [isAddingFamily, setIsAddingFamily] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingFamily, setIsSubmittingFamily] = useState(false);

  // Inside the main component, add a new state for patient statuses
  const [patientStatuses, setPatientStatuses] = useState<PatientStatus[]>([]);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  const patientId = params.id as string;
  const canInvite = canAccess('patients', 'write');

  // Define relationship options for family members
  const relationshipOptions = [
    { value: 'spouse', label: 'Spouse/Partner' },
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'friend', label: 'Friend' },
    { value: 'caregiver', label: 'Caregiver' },
    { value: 'other', label: 'Other' },
  ];

  // Form for address editing
  const addressForm = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      address_line1: '',
      address_line2: '',
      city: '',
      state_province: '',
      zip_postal_code: '',
    },
  });

  // Form for adding family members
  const familyForm = useForm<FamilyMemberFormValues>({
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

  // Fetch main patient details using select()
  useEffect(() => {
    const fetchPatient = async () => {
      setLoading(true);
      setError(null); // Reset error on new fetch

      if (!patientId) {
        setError('Patient ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: patientFetchError } = await supabase
          .from('patients')
          .select('*') // Fetch all columns for the detail view
          .eq('id', patientId)
          .single(); // Expect a single record

        if (patientFetchError) {
          // Handle case where RLS prevents access or patient genuinely not found
          if (patientFetchError.code === 'PGRST116') {
            // code for "Resource Not Found or No Access"
            setError('Patient not found or access denied.');
          } else {
            setError(`Failed to load patient data: ${patientFetchError.message}`);
          }
          console.error('Error fetching patient:', patientFetchError);
          setPatient(null);
        } else if (data) {
          setPatient(data as Patient); // Use the fetched data
        } else {
          setError('Patient not found.'); // Should be caught by .single() error ideally
          setPatient(null);
        }
      } catch (catchError: unknown) {
        // Catch unexpected errors during fetch
        console.error('Unexpected error fetching patient:', catchError);
        // Basic type check for error message
        const message =
          catchError instanceof Error ? catchError.message : 'An unexpected error occurred.';
        setError(message);
        setPatient(null);
      }

      setLoading(false);
    };

    fetchPatient();
  }, [patientId, supabase]);

  // Fetch family links using RPC
  useEffect(() => {
    if (!patient?.id) return;

    const fetchFamilyLinksRpc = async () => {
      setLinksLoading(true);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_all_family_links_for_patient', {
          p_patient_id: patient.id,
        });

        // Log the raw data for inspection
        if (data && data.length > 0) {
          console.log(
            'Raw data from get_all_family_links_for_patient RPC:',
            JSON.stringify(data[0], null, 2)
          );
        }

        // Always set the data if available, or empty array if not
        setFamilyLinks(data || []);

        // Don't set any errors - we'll just show the empty state
        if (rpcError) {
          console.log('Info: Error fetching family links:', rpcError);
        }
      } catch (error) {
        console.error('Error fetching family links:', error);
        // Don't set links error - we'll just show the empty state
      } finally {
        setLinksLoading(false);
      }
    };

    fetchFamilyLinksRpc();
  }, [patient, supabase]);

  // Update address form values when patient data changes
  useEffect(() => {
    if (patient) {
      addressForm.reset({
        address_line1: patient.address_line1,
        address_line2: patient.address_line2,
        city: patient.city,
        state_province: patient.state_province,
        zip_postal_code: patient.zip_postal_code,
      });
    }
  }, [patient, addressForm]);

  // Add the save address function
  const saveAddressChanges = async (data: AddressFormValues) => {
    if (!patient?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          address_line1: data.address_line1 ?? null,
          address_line2: data.address_line2 ?? null,
          city: data.city ?? null,
          state_province: data.state_province ?? null,
          zip_postal_code: data.zip_postal_code ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patient.id);

      if (error) throw error;

      // Update local state with correct types
      setPatient(prev => {
        if (!prev) return null;
        return {
          ...prev,
          address_line1: data.address_line1 ?? null,
          address_line2: data.address_line2 ?? null,
          city: data.city ?? null,
          state_province: data.state_province ?? null,
          zip_postal_code: data.zip_postal_code ?? null,
        };
      });

      toast({
        title: 'Address updated',
        description: 'The patient address has been successfully updated.',
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating address:', error);
      toast({
        title: 'Error',
        description: 'Failed to update address. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add a useEffect to fetch patient statuses
  useEffect(() => {
    const fetchPatientStatuses = async () => {
      try {
        const { data, error } = await supabase.from('patient_statuses').select('*');
        if (error) throw error;
        if (data) setPatientStatuses(data);
      } catch (error) {
        console.error('Error fetching patient statuses:', error);
      }
    };

    fetchPatientStatuses();
  }, [supabase]);

  // Add a function to update patient status
  const updatePatientStatus = async (statusId: number) => {
    if (!patient?.id) return;

    setStatusUpdateLoading(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          patient_status_id: statusId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patient.id);

      if (error) throw error;

      // Update local state
      setPatient(prev => {
        if (!prev) return null;
        return {
          ...prev,
          patient_status_id: statusId,
        };
      });

      toast({
        title: 'Status updated',
        description: 'The patient status has been successfully updated.',
      });
    } catch (error) {
      console.error('Error updating patient status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update patient status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Fix the family member form submission
  const saveFamilyMember = async (formData: FamilyMemberFormValues) => {
    if (!patient?.id) return;

    console.log('Submitting family member form with data:', formData);
    setIsSubmittingFamily(true);

    try {
      // Step 1: Check for existing profiles by email if provided
      let familyMemberUserId: string;
      let existingProfiles = null;

      if (formData.email) {
        console.log('Checking for existing profile with email:', formData.email);
        const { data: profilesByEmail, error: emailCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .limit(1);

        if (emailCheckError) {
          console.error('Error checking email:', emailCheckError);
        }

        if (!emailCheckError && profilesByEmail && profilesByEmail.length > 0) {
          console.log('Found existing profile by email:', profilesByEmail);
          existingProfiles = profilesByEmail;
        }
      }

      // If no profile found by email, check by name
      if (!existingProfiles) {
        console.log(
          'Checking for existing profile with name:',
          formData.firstName,
          formData.lastName
        );
        const { data: profilesByName, error: nameCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('first_name', formData.firstName)
          .eq('last_name', formData.lastName)
          .eq('role', 'family_contact')
          .limit(1);

        if (nameCheckError) {
          console.error('Error checking name:', nameCheckError);
        }

        if (!nameCheckError && profilesByName && profilesByName.length > 0) {
          console.log('Found existing profile by name:', profilesByName);
          existingProfiles = profilesByName;
        }
      }

      if (existingProfiles && existingProfiles.length > 0) {
        // Use existing profile
        console.log('Using existing profile ID:', existingProfiles[0].id);
        familyMemberUserId = existingProfiles[0].id;
      } else {
        // Create new profile using our custom function
        console.log('Creating new profile with:', formData.firstName, formData.lastName);
        const { data: newProfileId, error: createProfileError } = await supabase.rpc(
          'create_family_member_profile',
          {
            p_first_name: formData.firstName,
            p_last_name: formData.lastName,
            p_email: formData.email || null,
            p_phone: formData.phone || null,
          }
        );

        if (createProfileError) {
          console.error('Error creating profile:', createProfileError);
          throw new Error(`Error creating profile: ${createProfileError.message}`);
        }

        if (!newProfileId) {
          console.error('No profile ID returned');
          throw new Error('Failed to create profile - no ID returned');
        }

        console.log('Created new profile with ID:', newProfileId);
        familyMemberUserId = newProfileId;
      }

      // Step 2: Create the family link
      console.log('Creating family link with user ID:', familyMemberUserId);
      const { error: linkError } = await supabase.from('patient_family_links').insert({
        patient_id: patient.id,
        family_member_user_id: familyMemberUserId,
        relationship: formData.relationship,
        is_emergency_contact: formData.isEmergencyContact,
        is_designated_representative: formData.isDesignatedRepresentative,
        is_active: true,
      });

      if (linkError) {
        console.error('Error creating family link:', linkError);
        throw new Error(`Error creating family link: ${linkError.message}`);
      }

      console.log('Family link created successfully');
      toast({
        title: 'Success',
        description: 'Family member has been added successfully.',
      });

      // Reset form and refresh family links
      familyForm.reset();
      setIsAddingFamily(false);

      // Refresh the family links
      console.log('Refreshing family links');
      const fetchFamilyLinksRpc = async () => {
        setLinksLoading(true);
        try {
          const { data, error } = await supabase.rpc('get_all_family_links_for_patient', {
            p_patient_id: patient.id,
          });
          if (error) {
            console.error('Error fetching family links:', error);
          } else {
            // Log the raw data for inspection
            if (data && data.length > 0) {
              console.log(
                'Raw data from get_all_family_links_for_patient RPC (refresh):',
                JSON.stringify(data[0], null, 2)
              );
            }
            console.log('Fetched family links:', data);
            setFamilyLinks(data || []);
          }
        } catch (error) {
          console.error('Error refreshing family links:', error);
        } finally {
          setLinksLoading(false);
        }
      };

      fetchFamilyLinksRpc();
    } catch (error) {
      console.error('Error adding family member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add family member.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingFamily(false);
    }
  };

  // Fix the form submission by using explicit type casting where needed
  const handleSubmitFamilyForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formValues = familyForm.getValues();
    saveFamilyMember(formValues);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading patient data...</div>;
  }

  // Display error if main patient fetch failed
  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  // Display message if patient is null after loading (should be caught by error ideally)
  if (!patient) {
    return <div className="p-8 text-center">Patient data could not be loaded.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-gray-500">Patient ID: {patient.id}</p>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0">
          {canInvite && (
            <Link href={`/patients/${patient.id}/invite`}>
              <Button className="flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite to Portal
              </Button>
            </Link>
          )}
          <Link href="/scheduling">
            <Button variant="outline" className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              Staff Schedule
            </Button>
          </Link>
          <Button variant="outline" onClick={() => router.push('/patients')}>
            Back to List
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Patient Details</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                <p>
                  {patient.first_name} {patient.middle_name && `${patient.middle_name} `}
                  {patient.last_name} {patient.suffix && `, ${patient.suffix}`}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Preferred Name</h3>
                <p>{patient.preferred_name || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date of Birth</h3>
                <p>{new Date(patient.date_of_birth).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Gender</h3>
                <p>
                  {patient.gender_id === null
                    ? 'Not specified'
                    : patient.gender_id === 1
                    ? 'Male'
                    : 'Female'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Preferred Language</h3>
                <p>{patient.preferred_language || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Previous Name(s)</h3>
                <p>{patient.previous_name || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Social Security Number</h3>
                <p>{patient.social_security_number ? '***-**-****' : 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Branch</h3>
                <p>{patient.branch || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <div className="flex items-center space-x-2 mt-1">
                  {patientStatuses.length > 0 ? (
                    <>
                      <p
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          patient.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {patientStatuses.find(s => s.id === patient.patient_status_id)?.name ||
                          'Unknown'}
                      </p>
                      <Select
                        onValueChange={value => updatePatientStatus(Number(value))}
                        value={patient.patient_status_id.toString()}
                        disabled={statusUpdateLoading}
                      >
                        <SelectTrigger className="w-[180px] h-7 text-xs">
                          <SelectValue placeholder="Change status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Status</SelectLabel>
                            {patientStatuses.map(status => (
                              <SelectItem key={status.id} value={status.id.toString()}>
                                {status.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <p
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        patient.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {patient.is_active ? 'Active' : 'Inactive'}
                    </p>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Contact Information</h3>
                <div className="mt-1 space-y-1">
                  {patient.email && (
                    <p className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />
                      {patient.email}
                    </p>
                  )}
                  {patient.phone_number && (
                    <p className="flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4 text-gray-400" />
                      Home: {patient.phone_number}
                    </p>
                  )}
                  {patient.mobile_phone_number && (
                    <p className="flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4 text-gray-400" />
                      Mobile: {patient.mobile_phone_number}
                    </p>
                  )}
                  {patient.preferred_contact_method && (
                    <p className="flex items-center">
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Preferred: {patient.preferred_contact_method}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">Background Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Race</h3>
                <p>{patient.race || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Ethnicity</h3>
                <p>{patient.ethnicity || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Marital Status</h3>
                <p>{patient.marital_status || 'Not specified'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Address Information</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Edit Address
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      addressForm.reset({
                        address_line1: patient.address_line1,
                        address_line2: patient.address_line2,
                        city: patient.city,
                        state_province: patient.state_province,
                        zip_postal_code: patient.zip_postal_code,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={addressForm.handleSubmit(saveAddressChanges)}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                patient.address_line1 ? (
                  <div className="space-y-1">
                    <p>{patient.address_line1}</p>
                    {patient.address_line2 && <p>{patient.address_line2}</p>}
                    <p>
                      {[patient.city, patient.state_province, patient.zip_postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">No address information available</p>
                )
              ) : (
                <form className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Address Line 1</label>
                    <Input
                      placeholder="Street address"
                      {...addressForm.register('address_line1')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Address Line 2</label>
                    <Input
                      placeholder="Apt, Suite, Unit, etc."
                      {...addressForm.register('address_line2')}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">City</label>
                      <Input placeholder="City" {...addressForm.register('city')} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">State/Province</label>
                      <Input placeholder="State" {...addressForm.register('state_province')} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">ZIP/Postal Code</label>
                      <Input placeholder="ZIP code" {...addressForm.register('zip_postal_code')} />
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="mr-2 h-5 w-5" />
                Family Contacts & Portal Access
              </CardTitle>
              <CardDescription>
                Manage family member contacts and patient portal access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linksLoading && (
                <p className="text-gray-500 text-center py-8">Loading access information...</p>
              )}
              {!linksLoading && familyLinks.length === 0 && !isAddingFamily && (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">
                    No family members or caregivers are currently linked to this patient.
                  </p>
                  <p className="text-gray-500 text-sm">
                    Use the &quot;Add Family Member&quot; button below to add family members,
                    caregivers, or other authorized representatives.
                  </p>
                </div>
              )}
              {!linksLoading && familyLinks.length > 0 && !isAddingFamily && (
                <ul className="divide-y divide-gray-200">
                  {familyLinks.map(link => (
                    <li
                      key={link.link_id}
                      className="py-4 flex justify-between items-start flex-wrap"
                    >
                      <div>
                        <p className="font-medium">
                          {link.profile_first_name || 'Unknown'} {link.profile_last_name || 'User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Email: {link.profile_email || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Role: {link.profile_role || 'N/A'} | Relationship: {link.relationship}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={link.is_active ? 'default' : 'outline'}>
                            {link.is_active ? 'Link Active' : 'Link Inactive'}
                          </Badge>
                          <Badge
                            variant={link.is_emergency_contact ? 'destructive' : 'secondary'}
                            className="flex items-center"
                          >
                            {link.is_emergency_contact ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <X className="h-3 w-3 mr-1" />
                            )}
                            Emergency Contact
                          </Badge>
                          <Badge
                            variant={
                              link.is_designated_representative ? 'destructive' : 'secondary'
                            }
                            className="flex items-center"
                          >
                            {link.is_designated_representative ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <X className="h-3 w-3 mr-1" />
                            )}
                            Designated Rep/POA
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {isAddingFamily && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Add Family Member</h3>
                  <form onSubmit={handleSubmitFamilyForm} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">First Name</label>
                        <Input placeholder="First name" {...familyForm.register('firstName')} />
                        {familyForm.formState.errors.firstName && (
                          <p className="text-sm text-red-500">
                            {familyForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Last Name</label>
                        <Input placeholder="Last name" {...familyForm.register('lastName')} />
                        {familyForm.formState.errors.lastName && (
                          <p className="text-sm text-red-500">
                            {familyForm.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <Input type="email" placeholder="Email" {...familyForm.register('email')} />
                        {familyForm.formState.errors.email && (
                          <p className="text-sm text-red-500">
                            {familyForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Phone Number (Optional)
                        </label>
                        <Input placeholder="Phone number" {...familyForm.register('phone')} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Relationship to Patient
                      </label>
                      <Select
                        onValueChange={value => familyForm.setValue('relationship', value)}
                        value={familyForm.watch('relationship')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
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
                      {familyForm.formState.errors.relationship && (
                        <p className="text-sm text-red-500">
                          {familyForm.formState.errors.relationship.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isEmergencyContact"
                          checked={familyForm.watch('isEmergencyContact')}
                          onCheckedChange={checked =>
                            familyForm.setValue('isEmergencyContact', checked === true)
                          }
                        />
                        <label
                          htmlFor="isEmergencyContact"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Emergency Contact
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isDesignatedRepresentative"
                          checked={familyForm.watch('isDesignatedRepresentative')}
                          onCheckedChange={checked =>
                            familyForm.setValue('isDesignatedRepresentative', checked === true)
                          }
                        />
                        <label
                          htmlFor="isDesignatedRepresentative"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Designated Representative (POA)
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingFamily(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmittingFamily}>
                        {isSubmittingFamily ? 'Adding...' : 'Add Family Member'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              {!isAddingFamily && canInvite && (
                <>
                  <Button variant="secondary" onClick={() => setIsAddingFamily(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Family Member
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Appointments
              </CardTitle>
              <CardDescription>View and manage patient appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                Appointment management will be implemented in a future update.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button disabled>Schedule Appointment</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Medical Documents
              </CardTitle>
              <CardDescription>View and upload patient documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>
                  Manage admission forms, consent documents, medical records, and other files for
                  this patient.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gray-50 border border-dashed border-gray-300">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Admission Forms</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-gray-500">
                        Patient intake and registration documents
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-50 border border-dashed border-gray-300">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Consent Forms</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-gray-500">
                        Treatment consent and authorization documents
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-50 border border-dashed border-gray-300">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">Medical Records</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-gray-500">
                        Medical history and clinical documents
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Link href={`/patients/${patient.id}/documents`}>
                <Button>
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Documents
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
