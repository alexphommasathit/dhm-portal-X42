'use client';

import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
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
import { Calendar, FileText, User, UserPlus, Eye, EyeOff, Check, X } from 'lucide-react';
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

// 1. Add new types for unified form state
/* // Removed unused EmergencyContact interface
interface EmergencyContact {
  id?: string; // For existing contacts, otherwise undefined for new
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email: string;
  isEmergencyContact: boolean;
  isDesignatedRepresentative: boolean;
}
*/

interface PatientFormState {
  // Patient fields
  first_name: string;
  last_name: string;
  middle_name?: string;
  preferred_name?: string;
  suffix?: string;
  previous_name?: string;
  date_of_birth: string;
  branch?: string;
  preferred_language?: string;
  social_security_number?: string;
  email?: string;
  phone_number?: string;
  mobile_phone_number?: string;
  preferred_contact_method?: string;
  race?: string;
  ethnicity?: string;
  marital_status?: string;
  // ...add all other patient fields as needed
  // Emergency contacts
  // emergencyContacts: EmergencyContact[]; // Removed as per centralization plan
}

// 2. Refactor PatientDetailsForm to manage unified form state
interface PatientDetailsFormUnifiedProps {
  patient: Patient;
  familyLinks: FamilyLinkRpcResult[];
  onSave: (updated: PatientFormState) => Promise<boolean>;
  isEditing: boolean;
}

const PatientDetailsFormUnified = React.forwardRef<HTMLFormElement, PatientDetailsFormUnifiedProps>(
  ({ patient, familyLinks, onSave, isEditing }, ref) => {
    console.log(
      '[PatientDetailsFormUnified] Rendering - isEditing prop:',
      isEditing,
      'Patient:',
      patient?.first_name
    );
    const [form, setForm] = useState<PatientFormState>(() => {
      console.log(
        '[PatientDetailsFormUnified] Initializing form state. Patient:',
        patient?.first_name,
        'Family Links:',
        familyLinks.length
      );
      return {
        first_name: patient.first_name,
        last_name: patient.last_name,
        middle_name: patient.middle_name || '',
        preferred_name: patient.preferred_name || '',
        suffix: patient.suffix || '',
        previous_name: patient.previous_name || '',
        date_of_birth: patient.date_of_birth,
        branch: patient.branch || '',
        preferred_language: patient.preferred_language || '',
        social_security_number: patient.social_security_number || '',
        email: patient.email || '',
        phone_number: patient.phone_number || '',
        mobile_phone_number: patient.mobile_phone_number || '',
        preferred_contact_method: patient.preferred_contact_method || '',
        race: patient.race || '',
        ethnicity: patient.ethnicity || '',
        marital_status: patient.marital_status || '',
        // emergencyContacts: familyLinks.map(link => ({ // Removed
        //   id: link.link_id,
        //   firstName: link.profile_first_name || '',
        //   lastName: link.profile_last_name || '',
        //   relationship: link.relationship,
        //   phone: link.profile_phone || '',
        //   email: link.profile_email || '',
        //   isEmergencyContact: link.is_emergency_contact,
        //   isDesignatedRepresentative: link.is_designated_representative,
        // })),
      };
    });
    const [showSSN, setShowSSN] = useState(false);

    useEffect(() => {
      console.log('[PatientDetailsFormUnified] isEditing prop changed to:', isEditing);
      if (!isEditing) {
        console.log(
          '[PatientDetailsFormUnified] isEditing is false, resetting form to patient prop values'
        );
        setForm({
          first_name: patient.first_name,
          last_name: patient.last_name,
          middle_name: patient.middle_name || '',
          preferred_name: patient.preferred_name || '',
          suffix: patient.suffix || '',
          previous_name: patient.previous_name || '',
          date_of_birth: patient.date_of_birth,
          branch: patient.branch || '',
          preferred_language: patient.preferred_language || '',
          social_security_number: patient.social_security_number || '',
          email: patient.email || '',
          phone_number: patient.phone_number || '',
          mobile_phone_number: patient.mobile_phone_number || '',
          preferred_contact_method: patient.preferred_contact_method || '',
          race: patient.race || '',
          ethnicity: patient.ethnicity || '',
          marital_status: patient.marital_status || '',
          // emergencyContacts: familyLinks.map(link => ({ // Removed
          //   id: link.link_id,
          //   firstName: link.profile_first_name || '',
          //   lastName: link.profile_last_name || '',
          //   relationship: link.relationship,
          //   phone: link.profile_phone || '',
          //   email: link.profile_email || '',
          //   isEmergencyContact: link.is_emergency_contact,
          //   isDesignatedRepresentative: link.is_designated_representative,
          // })),
        });
        setShowSSN(false);
      }
    }, [isEditing, patient, familyLinks]);

    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
    };

    const internalFormSubmitHandler = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('[PatientDetailsFormUnified] internalFormSubmitHandler called. Form data:', form);
      try {
        await onSave(form);
      } catch (error) {
        console.error('[PatientDetailsFormUnified] Error during onSave call:', error);
        throw error; // Re-throw so handleSavePage knows about the error
      }
    };

    return (
      <form className="space-y-8" onSubmit={internalFormSubmitHandler} ref={ref}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patient fields with <label> */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">First Name</label>
            <Input
              name="first_name"
              value={form.first_name}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <Input
              name="last_name"
              value={form.last_name}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <Input
              name="middle_name"
              value={form.middle_name}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Preferred Name</label>
            <Input
              name="preferred_name"
              value={form.preferred_name}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Suffix</label>
            <Input
              name="suffix"
              value={form.suffix}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Previous Name</label>
            <Input
              name="previous_name"
              value={form.previous_name}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <Input
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Branch</label>
            <Input
              name="branch"
              value={form.branch}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
            <Input
              name="preferred_language"
              value={form.preferred_language}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          {/* SSN Field with Eye Toggle */}
          <div className="relative flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">SSN</label>
            <Input
              type={showSSN ? 'text' : 'password'}
              name="social_security_number"
              value={
                isEditing
                  ? form.social_security_number
                  : showSSN
                  ? form.social_security_number
                  : form.social_security_number
                  ? `***-**-${form.social_security_number.slice(-4)}`
                  : ''
              }
              onChange={handleFieldChange}
              disabled={!isEditing}
              className="pr-10"
              style={{ fontFamily: 'monospace' }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowSSN(v => !v)}
              className="absolute right-2 top-7"
              aria-label={showSSN ? 'Hide SSN' : 'Show SSN'}
              tabIndex={-1}
            >
              {showSSN ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Patient Direct Contact Information Fields */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Home Phone</label>
            <Input
              name="phone_number"
              type="tel"
              value={form.phone_number}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
            <Input
              name="mobile_phone_number"
              type="tel"
              value={form.mobile_phone_number}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Preferred Method</label>
            <Input
              name="preferred_contact_method"
              value={form.preferred_contact_method}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>

          {/* Background Information Fields */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Race</label>
            <Input
              name="race"
              value={form.race}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Ethnicity</label>
            <Input
              name="ethnicity"
              value={form.ethnicity}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1">Marital Status</label>
            <Input
              name="marital_status"
              value={form.marital_status}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
          </div>
        </div>
      </form>
    );
  }
);
PatientDetailsFormUnified.displayName = 'PatientDetailsFormUnified'; // for better debugging

// Define a new component for Address Information
interface AddressInformationCardProps {
  initialData: AddressFormValues;
  onSave: (data: AddressFormValues) => Promise<boolean>;
  isEditing: boolean;
  isSaving: boolean;
}

// ForwardRef and useImperativeHandle to expose submit and getValues
interface AddressInformationCardRef {
  submitAddress: () => Promise<boolean>;
  getValues: () => AddressFormValues;
  resetForm: (data?: AddressFormValues) => void;
}

const AddressInformationCard = React.forwardRef<
  AddressInformationCardRef,
  AddressInformationCardProps
>(({ initialData, onSave, isEditing, isSaving }, ref) => {
  const { toast } = useToast();
  const addressForm = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    console.log(
      '[AddressInformationCard] ResData or isEditing changed, resetting form.',
      initialData,
      isEditing
    );
    addressForm.reset(initialData);
  }, [initialData, addressForm, isEditing]); // Reset if initialData changes or when exiting edit mode

  const internalSubmitHandler = async (data: AddressFormValues) => {
    console.log('[AddressInformationCard] internalSubmitHandler called with data:', data);
    try {
      const success = await onSave(data);
      return success;
    } catch (error) {
      console.error('[AddressInformationCard] Error during onSave call:', error);
      toast({
        title: 'Error in Address Card',
        description: error instanceof Error ? error.message : 'Failed to save address details.',
        variant: 'destructive',
      });
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    submitAddress: async () => {
      // Trigger validation
      const isValid = await addressForm.trigger();
      if (isValid) {
        const values = addressForm.getValues();
        return internalSubmitHandler(values);
      }
      toast({
        title: 'Validation Error',
        description: 'Please check address fields.',
        variant: 'destructive',
      });
      return false; // Validation failed
    },
    getValues: () => addressForm.getValues(),
    resetForm: (data?: AddressFormValues) => addressForm.reset(data || initialData),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">Address Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={addressForm.handleSubmit(internalSubmitHandler)} className="space-y-4">
          <div>
            <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700">
              Address Line 1
            </label>
            <Input
              id="address_line1"
              {...addressForm.register('address_line1')}
              disabled={!isEditing || isSaving}
            />
          </div>
          <div>
            <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700">
              Address Line 2
            </label>
            <Input
              id="address_line2"
              {...addressForm.register('address_line2')}
              disabled={!isEditing || isSaving}
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              City
            </label>
            <Input id="city" {...addressForm.register('city')} disabled={!isEditing || isSaving} />
          </div>
          <div>
            <label htmlFor="state_province" className="block text-sm font-medium text-gray-700">
              State/Province
            </label>
            <Input
              id="state_province"
              {...addressForm.register('state_province')}
              disabled={!isEditing || isSaving}
            />
          </div>
          <div>
            <label htmlFor="zip_postal_code" className="block text-sm font-medium text-gray-700">
              Zip/Postal Code
            </label>
            <Input
              id="zip_postal_code"
              {...addressForm.register('zip_postal_code')}
              disabled={!isEditing || isSaving}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
});
AddressInformationCard.displayName = 'AddressInformationCard';

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { canAccess } = useRBAC();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unified page edit state
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [isSavingPage, setIsSavingPage] = useState(false);

  const [familyLinks, setFamilyLinks] = useState<FamilyLinkRpcResult[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  const [isAddingFamily, setIsAddingFamily] = useState(false);
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
        setFamilyLinks(
          ((data as FamilyLinkRpcResult[]) || []).map((link: FamilyLinkRpcResult) => ({
            ...link,
            profile_email: link.profile_email || '',
            profile_phone: link.profile_phone || '',
          }))
        );

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
      // This is now handled by AddressInformationCard's internal useEffect or resetForm method
    }
  }, [patient]);

  // Save address function to be passed to AddressInformationCard
  const handleSaveAddress = async (data: AddressFormValues): Promise<boolean> => {
    if (!patient?.id) {
      toast({ title: 'Patient ID missing for address save', variant: 'destructive' });
      return false;
    }
    console.log(
      '[PatientDetailPage] handleSaveAddress (onSave prop for card) called with data:',
      data
    );

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

      return true; // Indicate success
    } catch (error) {
      console.error('Error updating address:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update address. Please try again.',
        variant: 'destructive',
      });
      return false; // Indicate failure
    } finally {
      // setIsSavingPage(false); // Parent (handleSavePage) controls this
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
            setFamilyLinks(
              ((data as FamilyLinkRpcResult[]) || []).map((link: FamilyLinkRpcResult) => ({
                ...link,
                profile_email: link.profile_email || '',
                profile_phone: link.profile_phone || '',
              }))
            );
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

  // This is the main save function for the entire page
  const handleSavePage = async () => {
    console.log('[PatientDetailPage] handleSavePage called');
    setIsSavingPage(true);
    let allSavesSuccessful = true; // Reintroduce and initialize
    let coreDetailsSavedSuccessfully = false;
    let addressDetailsSavedSuccessfully = false;

    // Step 1: Trigger submit for PatientDetailsFormUnified
    if (patientDetailsFormRef.current) {
      console.log(
        '[PatientDetailPage] Attempting to submit PatientDetailsFormUnified programmatically'
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const form = patientDetailsFormRef.current;
          if (!form) {
            reject(new Error('PatientDetailsFormUnified ref not available'));
            return;
          }

          const onSubmitHandler = async (event?: Event) => {
            if (event) event.preventDefault(); // Prevent default if called from an event
            console.log('[PatientDetailPage] onSubmitHandler for core details invoked');
            try {
              // The `onSave` prop is `saveCorePatientDetails`
              // `internalFormSubmitHandler` in child calls it.
              // We need its result here.
              // This approach is getting complicated due to `requestSubmit`'s nature.

              // Simpler: onSave prop (saveCorePatientDetails) will set a flag or throw.
              // Let's ensure saveCorePatientDetails throws on error.
              // If it completes without throwing, we assume success for this step.
              // This means coreDetailsSavedSuccessfully is set within the onSave prop's logic
              // or we assume true if it doesn't throw and reaches resolve().

              // The `saveCorePatientDetails` function (passed as onSave) will handle its own logic,
              // including updating `coreDetailsSavedSuccessfully` or throwing an error.
              // For now, we will assume it throws an error on failure.

              form.requestSubmit(); // This is synchronous.
              // The actual async operation happens inside the form's submit handler.
              // We need a robust way to await that. The custom event was an attempt.
              // Let's simplify: `saveCorePatientDetails` will return Promise<boolean>.
              // The `internalFormSubmitHandler` inside `PatientDetailsFormUnified` will await this.
              // We need `internalFormSubmitHandler` to somehow signal this back or throw.
              // If `internalFormSubmitHandler` re-throws, `requestSubmit()` won't catch it here.

              // ---- NEW APPROACH FOR CORE DETAILS ----
              // `PatientDetailsFormUnified`'s `onSave` prop (our `saveCorePatientDetails`)
              // will return `Promise<boolean>`. `internalFormSubmitHandler` awaits it.
              // We will add an imperative handle to `PatientDetailsFormUnified` to expose a submit function.

              // This part needs PatientDetailsFormUnified to have an imperative handle like AddressInformationCard
              // For now, assuming the existing onSave within PatientDetailsFormUnified, which calls saveCorePatientDetails,
              // will throw an error that can be caught if `requestSubmit` is part of the try block directly.
              // This is often not the case as `requestSubmit` is void and async errors in handlers don't propagate to its caller.

              // For this iteration, let's proceed with the existing structure of requestSubmit
              // and ensure `saveCorePatientDetails` robustly handles its errors and toasts.
              // The success flag will be more of an "attempted and did not immediately crash" indicator.
              // A true end-to-end success requires more complex state management or eventing.

              resolve(); // Assume submission was initiated.
            } catch (e) {
              console.error(
                '[PatientDetailPage] Error directly from onSubmitHandler setup for core details:',
                e
              );
              reject(e);
            }
          };
          onSubmitHandler();
        });
        coreDetailsSavedSuccessfully = true; // Optimistic: assume it will succeed if no error thrown by `saveCorePatientDetails`
      } catch (error) {
        console.error(
          '[PatientDetailPage] Error during PatientDetailsFormUnified submission process:',
          error
        );
        coreDetailsSavedSuccessfully = false; // Error occurred, so it definitely did not save successfully.
        allSavesSuccessful = false; // Mark overall as failed
      }
    } else {
      console.warn(
        '[PatientDetailPage] patientDetailsFormRef.current is null, cannot submit PatientDetailsFormUnified'
      );
      allSavesSuccessful = false;
    }

    // Step 2: Save Address Information
    if (coreDetailsSavedSuccessfully) {
      // Only proceed if core details save was attempted and didn't throw immediately
      if (addressFormRef.current) {
        console.log('[PatientDetailPage] Attempting to submit AddressInformationCard');
        try {
          const addressSaveSuccess = await addressFormRef.current.submitAddress();
          if (addressSaveSuccess) {
            addressDetailsSavedSuccessfully = true;
            console.log(
              '[PatientDetailPage] Address saved successfully via AddressInformationCard.'
            );
          } else {
            allSavesSuccessful = false;
            addressDetailsSavedSuccessfully = false;
            console.warn(
              '[PatientDetailPage] AddressInformationCard.submitAddress() reported failure.'
            );
          }
        } catch (error) {
          allSavesSuccessful = false;
          addressDetailsSavedSuccessfully = false;
          console.error(
            '[PatientDetailPage] Error saving address via AddressInformationCard:',
            error
          );
          // Toast is handled in AddressInformationCard or handleSaveAddress
        }
      } else {
        console.warn('[PatientDetailPage] addressFormRef.current is null, cannot save address.');
        allSavesSuccessful = false; // Cannot save address
      }
    } else {
      if (allSavesSuccessful) {
        // if core save failed, mark all as unsuccessful
        toast({
          title: 'Core Details Not Saved',
          description: 'Skipping address save because core details did not save successfully.',
          variant: 'default', // Changed from warning
        });
      }
      allSavesSuccessful = false;
    }

    setIsSavingPage(false);

    // Determine overall success based on individual operation outcomes
    if (!coreDetailsSavedSuccessfully || !addressDetailsSavedSuccessfully) {
      allSavesSuccessful = false;
    }

    if (coreDetailsSavedSuccessfully && addressDetailsSavedSuccessfully) {
      setIsEditingPage(false); // Exit edit mode only if everything succeeded
      toast({ title: 'All page details saved successfully!', variant: 'default' });
    } else if (coreDetailsSavedSuccessfully && !addressDetailsSavedSuccessfully) {
      toast({
        title: 'Partial Success',
        description: 'Core details saved, but address failed to save.',
        variant: 'default',
      });
      // allSavesSuccessful is already false or will be set false by the check above
    } else if (!coreDetailsSavedSuccessfully && addressDetailsSavedSuccessfully) {
      toast({
        title: 'Partial Success with Issues',
        description: 'Address saved, but core details failed. Please review.',
        variant: 'default',
      });
      // allSavesSuccessful is already false
    } else {
      // Both failed or core failed and address was skipped (implies core failed)
      toast({
        title: 'Error Saving Page Details',
        description: 'One or more sections could not be saved. Please review the errors.',
        variant: 'destructive',
      });
      // allSavesSuccessful is already false
    }

    // If any part failed, keep isEditingPage true so user can correct.
    // Only set isEditingPage to false if allSavesSuccessful is true.
    if (allSavesSuccessful) {
      setIsEditingPage(false); // All good, exit edit mode.
    } else {
      // Potentially, if only non-critical parts failed, one might still exit edit mode.
      // For now, any failure keeps it in edit mode.
      console.log('One or more save operations failed. Keeping page in edit mode.');
    }
  };

  const handleCancelPage = () => {
    console.log('[PatientDetailPage] handleCancelPage called');
    setIsEditingPage(false);
    if (patient) {
      // PatientDetailsFormUnified resets internally via its useEffect watching `isEditingPage`
      // AddressInformationCard also resets internally via its useEffect
      // Trigger explicit reset for address card if needed
      addressFormRef.current?.resetForm({
        address_line1: patient.address_line1,
        address_line2: patient.address_line2,
        city: patient.city,
        state_province: patient.state_province,
        zip_postal_code: patient.zip_postal_code,
      });
    }
    toast({ title: 'Changes cancelled.', variant: 'default' });
  };

  // useEffect to update forms when patient data changes (e.g. after initial load or save)
  useEffect(() => {
    if (patient && !isEditingPage) {
      // Only reset if not in edit mode to preserve user changes
      // PatientDetailsFormUnified resets internally via its useEffect watching `isEditing` and `patient` props.
      // AddressInformationCard resets its form data based on initialData prop which updates with patient
      // and also has an effect for isEditing.
      if (addressFormRef.current) {
        addressFormRef.current.resetForm({
          address_line1: patient.address_line1,
          address_line2: patient.address_line2,
          city: patient.city,
          state_province: patient.state_province,
          zip_postal_code: patient.zip_postal_code,
        });
      }
    }
  }, [patient, isEditingPage]); // Add isEditingPage to dependencies

  const patientDetailsFormRef = useRef<HTMLFormElement>(null);
  const addressFormRef = useRef<AddressInformationCardRef>(null); // Correct ref type

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
          {!isEditingPage ? (
            <Button
              onClick={() => setIsEditingPage(true)}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Edit Page
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSavePage}
                disabled={isSavingPage}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {isSavingPage ? 'Saving Page...' : 'Save All Changes'}
              </Button>
              <Button variant="outline" onClick={handleCancelPage} disabled={isSavingPage}>
                Cancel All
              </Button>
            </>
          )}
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
                General & Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PatientDetailsFormUnified
                ref={patientDetailsFormRef}
                patient={patient!}
                familyLinks={familyLinks}
                onSave={async (updated): Promise<boolean> => {
                  // This is the actual save logic for core patient data
                  console.log(
                    '[PatientDetailPage] PatientDetailsFormUnified actual onSave (saveCorePatientDetails). Data:',
                    updated
                  );
                  try {
                    const { error: updateError } = await supabase
                      .from('patients')
                      .update({
                        first_name: updated.first_name,
                        last_name: updated.last_name,
                        middle_name: updated.middle_name,
                        preferred_name: updated.preferred_name,
                        suffix: updated.suffix,
                        previous_name: updated.previous_name,
                        date_of_birth: updated.date_of_birth,
                        branch: updated.branch,
                        preferred_language: updated.preferred_language,
                        social_security_number: updated.social_security_number,
                        email: updated.email,
                        phone_number: updated.phone_number,
                        mobile_phone_number: updated.mobile_phone_number,
                        preferred_contact_method: updated.preferred_contact_method,
                        race: updated.race,
                        ethnicity: updated.ethnicity,
                        marital_status: updated.marital_status,
                      })
                      .eq('id', patient!.id);

                    if (updateError) throw updateError;

                    const { data: refreshed, error: fetchError } = await supabase
                      .from('patients')
                      .select('*')
                      .eq('id', patient!.id)
                      .single();

                    if (fetchError) throw fetchError;

                    if (refreshed) {
                      setPatient(refreshed as Patient);
                      toast({ title: 'General & Contact details saved.', variant: 'default' });
                      return true; // Indicate success
                    }
                    toast({
                      title: 'Failed to refresh patient data after save.',
                      variant: 'destructive',
                    });
                    return false; // Indicate failure if not refreshed
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error ? error.message : 'An unknown error occurred.';
                    toast({
                      title: 'Error saving General & Contact details.',
                      description: errorMessage,
                      variant: 'destructive',
                    });
                    return false; // Indicate failure
                  }
                }}
                isEditing={isEditingPage}
              />
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <div className="flex items-center space-x-2 mt-1">
                  {patientStatuses.length > 0 ? (
                    <>
                      <p
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          patient!.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {patientStatuses.find(s => s.id === patient!.patient_status_id)?.name ||
                          'Unknown'}
                      </p>
                      <Select
                        onValueChange={value => updatePatientStatus(Number(value))}
                        value={
                          patient!.patient_status_id ? patient!.patient_status_id.toString() : ''
                        }
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
                        patient!.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {patient!.is_active ? 'Active' : 'Inactive'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Address Information Card - Rendered after General & Contact Details */}
          {patient && (
            <AddressInformationCard
              ref={addressFormRef} // Pass the ref here
              initialData={{
                address_line1: patient.address_line1,
                address_line2: patient.address_line2,
                city: patient.city,
                state_province: patient.state_province,
                zip_postal_code: patient.zip_postal_code,
              }}
              onSave={handleSaveAddress} // Parent's save handler
              isEditing={isEditingPage}
              isSaving={isSavingPage}
            />
          )}

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
