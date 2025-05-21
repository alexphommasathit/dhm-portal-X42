'use client';

import Protected from '@/components/Protected';
import { useRBAC } from '@/context/RBACContext';
import { createBrowserSupabase } from '@/lib/supabase/client'; // Assuming client setup utility
import Link from 'next/link';
import { useState, useEffect } from 'react'; // Import useState and useEffect

// Define types for fetched data (adjust based on actual query)
// Define our own interface since generated types seem to conflict with the join structure
interface FetchedPatient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  is_active: boolean;
  patient_statuses: { name: string } | null; // Structure expected from Supabase join
  // Include other columns selected by '*' from the 'patients' table if needed for display/logic
  profile_id?: string | null;
  ehr_patient_id?: string | null;
  medical_record_number?: string | null;
  middle_name?: string | null;
  preferred_name?: string | null;
  gender_id?: number | null;
  email?: string | null;
  phone_number?: string | null;
  phone_number_type?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  zip_postal_code?: string | null;
  country?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_email?: string | null;
  emergency_contact_relationship?: string | null;
  patient_status_id?: number;
  deceased_date?: string | null;
  preferred_language_id?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  // Calculated fields (optional)
  age?: number;
}

export default function PatientsPage() {
  const { canAccess } = useRBAC();
  const [deleteConfirmPatient, setDeleteConfirmPatient] = useState<string | null>(null); // Use string for UUID
  const [patients, setPatients] = useState<FetchedPatient[]>([]); // State uses our custom FetchedPatient type
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState<string | null>(null); // Error state

  const supabase = createBrowserSupabase();

  // Function to calculate age
  const calculateAge = (dob: string | null): number | undefined => {
    if (!dob) return undefined;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      console.error('Error calculating age:', e);
      return undefined;
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      setError(null);

      // Fetch patients and join with patient_statuses to get status name
      // Adjust select query based on actual columns needed and new schema
      const { data, error: fetchError } = await supabase
        .from('patients')
        // Select all patient columns AND the joined status name
        .select(
          `
          *,
          patient_statuses ( name )
        `
        )
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (fetchError) {
        console.error('Error fetching patients:', fetchError);
        setError(`Failed to load patient data: ${fetchError.message}`);
        setPatients([]);
      } else if (data) {
        // Calculate age for each patient
        const patientsWithAge = data.map(p => ({
          ...p,
          age: calculateAge(p.date_of_birth),
          // Ensure patient_statuses is an object with a name, even if join returns null or error
          patient_statuses:
            p.patient_statuses &&
            typeof p.patient_statuses === 'object' &&
            'name' in p.patient_statuses
              ? p.patient_statuses
              : { name: 'Unknown' },
        }));
        // Now the data structure should align better with FetchedPatient
        setPatients(patientsWithAge as FetchedPatient[]);
      } else {
        setPatients([]);
      }
      setLoading(false);
    };

    fetchPatients();
  }, [supabase]); // Re-run if supabase client instance changes (unlikely but good practice)

  // Determine if user has write permission for more actions
  const canEdit = canAccess('patients', 'write');
  const canAdminister = canAccess('patients', 'admin');

  // Handle delete with confirmation - Use string for UUID
  const handleDeleteClick = (patientId: string) => {
    setDeleteConfirmPatient(patientId);
  };

  const confirmDelete = (patientId: string) => {
    // In a real app, this would make an API call to delete the patient
    // e.g., await supabase.rpc('delete_patient', { p_patient_id: patientId });
    console.log(`Simulating delete for patient ${patientId}`);
    // Optimistically remove from UI or refetch list
    setPatients(prev => prev.filter(p => p.id !== patientId));
    setDeleteConfirmPatient(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmPatient(null);
  };

  return (
    <Protected resource="patients" permission="read">
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Patient Management</h1>
            <p className="text-gray-600">View and manage patient information</p>
          </header>

          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6 bg-blue-50 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Patients Directory</h2>
                {canEdit && (
                  <Link
                    href="/patients/create"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add New Patient
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                You have {canAdminister ? 'administrative' : canEdit ? 'write' : 'read-only'} access
                to patient records
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Age
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    {(canEdit || canAdminister) && (
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center p-4">
                        Loading patients...
                      </td>
                    </tr>
                  )}
                  {error && (
                    <tr>
                      <td colSpan={5} className="text-center p-4 text-red-600">
                        {error}
                      </td>
                    </tr>
                  )}
                  {!loading && !error && patients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center p-4">
                        No patients found.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    !error &&
                    patients.map(
                      (
                        patient // Use fetched patients state
                      ) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Use first_name and last_name */}
                            <div className="font-medium text-gray-900">
                              {patient.first_name} {patient.last_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {patient.age !== undefined ? patient.age : 'N/A'}{' '}
                            {/* Display calculated age */}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Use status name from joined table and is_active field */}
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                patient.is_active && patient.patient_statuses?.name === 'Active' // Example logic, adjust as needed
                                  ? 'bg-green-100 text-green-800'
                                  : patient.is_active
                                  ? 'bg-yellow-100 text-yellow-800' // Indicate active but maybe different status
                                  : 'bg-gray-100 text-gray-800' // Inactive overall
                              }`}
                            >
                              {patient.is_active
                                ? patient.patient_statuses?.name ?? 'Unknown Status'
                                : 'Inactive (Overall)'}
                            </span>
                          </td>
                          {(canEdit || canAdminister) && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                href={`/patients/${patient.id}`}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                View
                              </Link>

                              {canEdit && (
                                <Link
                                  href={`/patients/${patient.id}/edit`}
                                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                                >
                                  Edit
                                </Link>
                              )}

                              {canAdminister && (
                                <>
                                  {deleteConfirmPatient === patient.id ? (
                                    <span>
                                      <button
                                        onClick={() => confirmDelete(patient.id)}
                                        className="text-red-700 hover:text-red-900 font-bold mr-2"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={cancelDelete}
                                        className="text-gray-600 hover:text-gray-800"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteClick(patient.id)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="text-blue-600 hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </Protected>
  );
}
