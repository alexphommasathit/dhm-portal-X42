'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
// We'll create this modal later
import InviteStaffModal from '@/components/admin/InviteStaffModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Define the expected shape of a staff member object from the API
interface StaffMember {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  job_title: string | null;
  status: string; // 'Active', 'Invited', etc.
}

export default function ManageStaffPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/staff');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch staff list');
      }
      const data = await response.json();
      setStaffList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
  }, []);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Staff</h1>
        <Button onClick={() => setShowInviteModal(true)}>Invite New Staff</Button>
      </div>

      {showInviteModal && (
        <InviteStaffModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={() => {
            setShowInviteModal(false);
            fetchStaffList(); // Refetch staff list after invite
          }}
        />
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {isLoading && <div className="p-6 text-center">Loading staff...</div>}
        {error && <div className="p-6 text-center text-red-500">Error: {error}</div>}
        {!isLoading && !error && staffList.length === 0 && (
          <div className="p-6 text-center text-gray-500">No staff members found.</div>
        )}
        {!isLoading && !error && staffList.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map(member => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.first_name || ''} {member.last_name || ''}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>{member.job_title || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === 'Active' ? 'default' : 'secondary'}
                      className={
                        member.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm">
                      Edit
                    </Button>{' '}
                    {/* Placeholder */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// Placeholder function for fetching staff list
// async function fetchStaffList() {
//   // This would typically call a Next.js API route that queries your 'profiles' table
//   // and filters for staff roles.
//   // Example: const response = await fetch('/api/admin/staff');
//   // if (!response.ok) throw new Error('Failed to fetch staff');
//   // return response.json();
//
//   // Dummy data for now:
//   return [
//     { id: '1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', role: 'administrator', status: 'active' },
//     { id: '2', firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', role: 'clinical_administrator', status: 'invited' },
//   ];
// }
