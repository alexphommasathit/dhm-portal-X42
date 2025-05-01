'use client'

import Protected from '@/components/Protected'
import { useRBAC } from '@/context/RBACContext'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

// Sample data for demonstration
const samplePatients = [
  { id: 1, name: 'Jane Smith', age: 42, status: 'Active', condition: 'Hypertension' },
  { id: 2, name: 'Robert Johnson', age: 65, status: 'Active', condition: 'Diabetes' },
  { id: 3, name: 'Maria Garcia', age: 38, status: 'Inactive', condition: 'Arthritis' },
  { id: 4, name: 'James Williams', age: 57, status: 'Active', condition: 'COPD' },
  { id: 5, name: 'Sarah Brown', age: 29, status: 'Active', condition: 'Anxiety' },
]

export default function PatientsPage() {
  const { canAccess, userRole } = useRBAC()
  const { profile } = useAuth()
  
  // Determine if user has write permission for more actions
  const canEdit = canAccess('patients', 'write')
  const canAdminister = canAccess('patients', 'admin')
  
  return (
    <Protected resource="patients" permission="read">
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Patient Management</h1>
            <p className="text-gray-600">
              View and manage patient information
            </p>
          </header>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6 bg-blue-50 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Patients Directory</h2>
                {canEdit && (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Add New Patient
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                You have {canAdminister ? 'administrative' : canEdit ? 'write' : 'read-only'} access to patient records
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condition
                    </th>
                    {(canEdit || canAdminister) && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {samplePatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{patient.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {patient.age}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          patient.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {patient.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {patient.condition}
                      </td>
                      {(canEdit || canAdminister) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            View
                          </button>
                          {canEdit && (
                            <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                              Edit
                            </button>
                          )}
                          {canAdminister && (
                            <button className="text-red-600 hover:text-red-900">
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
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
  )
} 