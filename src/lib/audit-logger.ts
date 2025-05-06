import { createClientComponentSupabase } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

// Define audit event types
export type AuditEventType =
  | 'access' // Viewed PHI
  | 'create' // Created new PHI
  | 'update' // Modified existing PHI
  | 'delete' // Deleted PHI
  | 'export' // Exported/downloaded PHI
  | 'auth' // Authentication events
  | 'admin' // Administrative actions
  | 'system'; // System-level events

// Define the structure of an audit log entry using Database type
export type AuditLogEntry = Omit<
  Database['public']['Tables']['audit_logs']['Insert'],
  'id' | 'created_at'
>;

/**
 * HIPAA-compliant audit logger for tracking all PHI access
 * This logger records detailed information about each access to protected health information
 */
export class AuditLogger {
  private supabase = createClientComponentSupabase();

  /**
   * Log an audit event
   *
   * @param event - The audit event to log
   * @returns boolean indicating success or failure
   */
  async logEvent(
    event: Omit<AuditLogEntry, 'timestamp' | 'ip_address' | 'user_agent'>
  ): Promise<boolean> {
    try {
      // Get IP and user agent information
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();

      // Create the full audit log entry
      const logEntry: AuditLogEntry = {
        ...event,
        ip_address: ipData.ip,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      // Send the audit log to the database
      const { error } = await this.supabase.from('audit_logs').insert(logEntry);

      if (error) {
        console.error('Failed to log audit event:', error);

        // Fallback to local storage if database logging fails
        this.logToLocalFallback(logEntry);

        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in audit logging:', err);

      // Fallback to local storage if an error occurs
      this.logToLocalFallback(event as AuditLogEntry);

      return false;
    }
  }

  /**
   * Log PHI access event
   *
   * @param userId - ID of the user accessing the PHI
   * @param resourceType - Type of resource being accessed (e.g., 'patient', 'prescription')
   * @param resourceId - ID of the specific resource
   * @param details - Additional details about the access
   * @param success - Whether the access was successful
   * @returns boolean indicating logging success
   */
  async logAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, any> = {},
    success: boolean = true
  ): Promise<boolean> {
    return this.logEvent({
      user_id: userId,
      action: 'access',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      success,
    });
  }

  /**
   * Log PHI modification event
   *
   * @param userId - ID of the user modifying the PHI
   * @param resourceType - Type of resource being modified
   * @param resourceId - ID of the specific resource
   * @param details - Details of the modification (should include before/after values)
   * @param success - Whether the modification was successful
   * @returns boolean indicating logging success
   */
  async logModification(
    userId: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, any> = {},
    success: boolean = true
  ): Promise<boolean> {
    return this.logEvent({
      user_id: userId,
      action: 'update',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      success,
    });
  }

  /**
   * Log authentication events
   *
   * @param userId - ID of the user
   * @param details - Details about the authentication event
   * @param success - Whether authentication was successful
   * @returns boolean indicating logging success
   */
  async logAuth(
    userId: string,
    details: Record<string, any> = {},
    success: boolean = true
  ): Promise<boolean> {
    return this.logEvent({
      user_id: userId,
      action: 'auth',
      resource_type: 'credentials',
      details,
      success,
    });
  }

  /**
   * Fallback logging to local storage when database logging fails
   * These logs should be synced to the server when connection is restored
   *
   * @param logEntry - The audit log entry to store locally
   */
  private logToLocalFallback(logEntry: AuditLogEntry): void {
    try {
      // Get existing pending logs
      const existingLogsJSON = localStorage.getItem('pendingAuditLogs');
      const existingLogs = existingLogsJSON ? JSON.parse(existingLogsJSON) : [];

      // Add the new log
      existingLogs.push({
        ...logEntry,
        timestamp: logEntry.timestamp || new Date().toISOString(),
        _pendingSince: new Date().toISOString(),
      });

      // Save back to local storage
      localStorage.setItem('pendingAuditLogs', JSON.stringify(existingLogs));

      console.warn('Audit log saved to local storage fallback');
    } catch (err) {
      console.error('Failed to log to local storage fallback:', err);
    }
  }

  /**
   * Sync any pending local logs to the server
   * Should be called periodically to ensure no logs are lost
   *
   * @returns number of logs synced
   */
  async syncPendingLogs(): Promise<number> {
    try {
      // Get existing pending logs
      const existingLogsJSON = localStorage.getItem('pendingAuditLogs');
      if (!existingLogsJSON) return 0;

      const pendingLogs = JSON.parse(existingLogsJSON);
      if (pendingLogs.length === 0) return 0;

      // Send logs to the database
      const { error } = await this.supabase.from('audit_logs').insert(
        pendingLogs.map((log: any) => {
          // Remove pendingSince field before sending to the server
          const { _pendingSince, ...cleanLog } = log;
          return cleanLog;
        })
      );

      if (error) {
        console.error('Failed to sync pending audit logs:', error);
        return 0;
      }

      // Clear the pending logs
      localStorage.removeItem('pendingAuditLogs');

      return pendingLogs.length;
    } catch (err) {
      console.error('Error syncing pending audit logs:', err);
      return 0;
    }
  }
}

// Singleton instance for use throughout the application
export const auditLogger = new AuditLogger();

// Helper function to get the requester's IP address on the server side
export async function getRequesterIP(): Promise<string> {
  try {
    // This is a simple approach. In production, you might use a more robust solution
    // or headers from a reverse proxy
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (err) {
    console.error('Failed to get requester IP:', err);
    return 'unknown';
  }
}
