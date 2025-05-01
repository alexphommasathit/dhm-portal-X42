'use client'

import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { useAuth } from './AuthContext'
import type { Database } from '@/types/supabase'

// Define role type from the database schema
type Role = Database['public']['Enums']['user_role']

// Define permission levels for resources
export type ResourcePermission = 'read' | 'write' | 'admin' | 'none'

// Define resources in the application that can be protected
export type Resource = 
  | 'patients'
  | 'staff'
  | 'financial'
  | 'admin'
  | 'reports'
  | 'schedules'
  | 'referrals'
  | 'billing'

// RBAC context interface
interface RBACContextType {
  userRole: Role | null
  canAccess: (resource: Resource, requiredPermission: ResourcePermission) => boolean
  isAdmin: boolean
  allowedResources: Resource[]
}

// Create context with a default value
const RBACContext = createContext<RBACContextType | undefined>(undefined)

// Role-based permission matrix
// This maps roles to their permissions for each resource
const rolePermissions: Record<Role, Partial<Record<Resource, ResourcePermission>>> = {
  administrator: {
    patients: 'admin',
    staff: 'admin',
    financial: 'admin',
    admin: 'admin',
    reports: 'admin',
    schedules: 'admin',
    referrals: 'admin',
    billing: 'admin',
  },
  hr_admin: {
    staff: 'admin',
    schedules: 'admin',
    reports: 'read',
  },
  financial_admin: {
    financial: 'admin',
    billing: 'admin',
    reports: 'read',
    patients: 'read',
  },
  clinician: {
    patients: 'write',
    schedules: 'write',
    reports: 'write',
    referrals: 'read',
  },
  assistant: {
    patients: 'read',
    schedules: 'read',
    referrals: 'read',
  },
  hha: {
    patients: 'read',
    schedules: 'read',
  },
  patient: {
    patients: 'none', // Patients can only see their own data, handled separately
    schedules: 'read',
  },
  family_caregiver: {
    patients: 'none', // Family caregivers can only see their related patients, handled separately
    schedules: 'read',
  },
  case_manager: {
    patients: 'write',
    reports: 'read',
    referrals: 'write',
    schedules: 'read',
  },
  referral_source: {
    referrals: 'write',
  },
  unassigned: {
    // No access to any resources
  },
}

// Defines which roles are considered administrative
const adminRoles: Role[] = ['administrator', 'hr_admin']

interface RBACProviderProps {
  children: ReactNode
}

export function RBACProvider({ children }: RBACProviderProps) {
  const { profile } = useAuth()
  
  // User's current role
  const userRole = profile?.role || null
  
  // Determine if the user has admin access
  const isAdmin = userRole ? adminRoles.includes(userRole) : false
  
  // Get the list of all resources the user can access
  const allowedResources = useMemo(() => {
    if (!userRole) return []
    
    const permissions = rolePermissions[userRole]
    return Object.entries(permissions)
      .filter(([_, permission]) => permission !== 'none')
      .map(([resource]) => resource as Resource)
  }, [userRole])
  
  // Function to check if a user has access to a specific resource
  const canAccess = (resource: Resource, requiredPermission: ResourcePermission): boolean => {
    // No access if no role is assigned
    if (!userRole) return false
    
    // Get the user's permission level for the resource
    const userPermission = rolePermissions[userRole][resource] || 'none'
    
    // Permission hierarchy: admin > write > read > none
    const permissionHierarchy: Record<ResourcePermission, number> = {
      'admin': 3,
      'write': 2,
      'read': 1,
      'none': 0
    }
    
    // Check if the user's permission level is sufficient
    return permissionHierarchy[userPermission] >= permissionHierarchy[requiredPermission]
  }
  
  const value = {
    userRole,
    canAccess,
    isAdmin,
    allowedResources,
  }
  
  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  )
}

// Custom hook to use the RBAC context
export function useRBAC() {
  const context = useContext(RBACContext)
  if (context === undefined) {
    throw new Error('useRBAC must be used within an RBACProvider')
  }
  return context
} 