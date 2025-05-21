'use client';

import { useState } from 'react';

// Types for our result data
interface DatabaseResult {
  success: boolean;
  data: any[];
  connectionInfo?: {
    url: string;
    bypassRLS?: boolean;
    useServiceFunction?: boolean;
  };
  message?: string;
  method?: string;
}

// Simple debug panel that uses a direct database connection
export default function DebugPanel() {
  const [result, setResult] = useState<DatabaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState('patients');
  const [id, setId] = useState('');
  const [bypassRLS, setBypassRLS] = useState(true);
  const [useServiceFunction, setUseServiceFunction] = useState(false);

  async function runTest() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Build the query string with appropriate parameters
      const params = new URLSearchParams();
      params.append('table', table);
      if (id) params.append('id', id);
      if (bypassRLS) params.append('bypass', 'true');
      if (useServiceFunction) params.append('service', 'true');

      // Call our direct database endpoint
      const response = await fetch(`/api/direct-db?${params.toString()}`);
      const json = await response.json();

      if (json.success) {
        setResult(json);
      } else {
        setError(json.error || 'An unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function checkDatabaseConnection() {
    setTable('patients');
    setId('');
    runTest();
  }

  function checkPatientById() {
    setTable('patients');
    runTest();
  }

  function checkProfiles() {
    setTable('profiles');
    setId('');
    runTest();
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Database Debug Panel</h1>
      <p style={{ marginBottom: '2rem' }}>
        This panel helps diagnose database connectivity and Row Level Security (RLS) issues.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Table:</label>
          <select
            value={table}
            onChange={e => setTable(e.target.value)}
            style={{
              padding: '0.5rem',
              width: '100%',
              borderRadius: '0.25rem',
              border: '1px solid #ccc',
            }}
          >
            <option value="patients">patients</option>
            <option value="profiles">profiles</option>
            <option value="appointments">appointments</option>
            <option value="patient_documents">patient_documents</option>
            <option value="patient_notes">patient_notes</option>
            <option value="user_permissions">user_permissions</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>ID (optional):</label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="Enter ID to filter (UUID format)"
            style={{
              padding: '0.5rem',
              width: '100%',
              borderRadius: '0.25rem',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={bypassRLS}
                onChange={e => setBypassRLS(e.target.checked)}
              />
              Bypass RLS (use service role)
            </label>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              Use service role key to bypass RLS policies
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={useServiceFunction}
                onChange={e => setUseServiceFunction(e.target.checked)}
              />
              Use service function
            </label>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              Use SECURITY DEFINER function (patients table only)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={runTest}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Running...' : 'Run Query'}
          </button>

          <button
            onClick={checkDatabaseConnection}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Check All Patients
          </button>

          <button
            onClick={checkPatientById}
            disabled={loading || !id}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: id ? '#8b5cf6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: id ? 'pointer' : 'not-allowed',
            }}
          >
            Find Patient
          </button>

          <button
            onClick={checkProfiles}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ec4899',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Check Profiles
          </button>
        </div>

        {/* Add some quick access buttons for sample UUIDs */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Sample IDs:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              onClick={() => setId('b44f52c0-d2de-43b5-86c9-eb157306f7cb')}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                fontSize: '0.8rem',
              }}
            >
              John Doe
            </button>
            <button
              onClick={() => setId('c44f52c0-d2de-43b5-86c9-eb157306f7cb')}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                fontSize: '0.8rem',
              }}
            >
              Jane Smith
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            borderRadius: '0.25rem',
            color: '#b91c1c',
            marginBottom: '1rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Results</h2>

          <div style={{ marginBottom: '1rem' }}>
            <strong>Connection Info:</strong>
            <div>URL: {result.connectionInfo?.url || 'Not available'}</div>
            <div>Bypass RLS: {result.connectionInfo?.bypassRLS ? 'Yes' : 'No'}</div>
            <div>Service Function: {result.connectionInfo?.useServiceFunction ? 'Yes' : 'No'}</div>
            {result.method && (
              <div>
                Method Used: <span className="font-semibold">{result.method}</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <strong>Data ({result.data?.length || 0} records):</strong>
            {result.message && (
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                {result.message}
              </div>
            )}
          </div>

          <pre
            style={{
              backgroundColor: '#f3f4f6',
              padding: '1rem',
              borderRadius: '0.25rem',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.25rem',
        }}
      >
        <h3 style={{ marginBottom: '0.5rem' }}>Troubleshooting Steps</h3>
        <ol style={{ paddingLeft: '1.5rem' }}>
          <li>Check that the database is running and accessible</li>
          <li>Verify that the PRIVATE_SUPABASE_SERVICE_KEY environment variable is set</li>
          <li>Try enabling "Bypass RLS" if you're getting permission errors</li>
          <li>Use "Service Function" for more complex queries that need to bypass security</li>
          <li>Examine the returned error messages for clues about what's wrong</li>
        </ol>
      </div>
    </div>
  );
}
