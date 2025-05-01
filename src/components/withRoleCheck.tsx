'use client'

import { ComponentType } from 'react'
import { Resource, ResourcePermission } from '@/context/RBACContext'
import Protected from './Protected'

// HOC to protect routes based on role permissions
export default function withRoleCheck(
  Component: ComponentType<any>,
  resource: Resource,
  permission: ResourcePermission
) {
  function ProtectedRoute(props: any) {
    return (
      <Protected resource={resource} permission={permission}>
        <Component {...props} />
      </Protected>
    )
  }
  
  // Set display name for debugging
  const displayName = Component.displayName || Component.name || 'Component'
  ProtectedRoute.displayName = `withRoleCheck(${displayName})`
  
  return ProtectedRoute
} 