import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/process
 * Process a document to extract text and create chunks
 *
 * Request body: { documentId: string }
 */
export async function POST(request: NextRequest) {
  // Initialize logging variables to null or a default value
  let userIdForLogging: string | null = null;
  let documentIdForLogging: string | null = null;

  try {
    const supabase = createServerActionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Assign potentially undefined user.id to string | null
    userIdForLogging = user?.id ?? null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Only admins can process documents
    if (!profile || !['administrator', 'hr_admin'].includes(profile.role)) {
      // TODO: Implement server-side audit logging for unauthorized attempt if needed
      // await supabase.from('audit_logs').insert({ user_id: user.id, action: 'process', ... });
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { documentId } = body;
    // Assign potentially undefined documentId to string | null
    documentIdForLogging = documentId ?? null;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get the user's access token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.access_token) {
      console.error('Error getting user session for edge function invocation:', sessionError);
      return NextResponse.json({ error: 'Failed to authenticate for processing' }, { status: 500 });
    }
    const accessToken = sessionData.session.access_token;

    // Invoke the policy-parser function
    console.log(`[API Route] Invoking policy-parser for doc ${documentId}`);
    const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
      'policy-parser',
      { body: { documentId }, headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (functionError) {
      console.error(
        `[API Route] Error invoking policy-parser for doc ${documentId}:`,
        functionError
      );
      // TODO: Implement server-side audit logging for invocation failure if needed
      // Use userIdForLogging and documentIdForLogging here
      // await supabase.from('audit_logs').insert({ user_id: userIdForLogging, resource_id: documentIdForLogging, ... });
      return NextResponse.json(
        { error: 'Failed to invoke document processing function', details: functionError.message },
        { status: 500 }
      );
    }

    console.log('[API Route] Policy-parser function invoked successfully:', functionResponse);
    // TODO: Implement server-side audit logging for successful invocation if needed
    // Use userIdForLogging and documentIdForLogging here
    // await supabase.from('audit_logs').insert({ user_id: userIdForLogging, resource_id: documentIdForLogging, ... });

    return NextResponse.json({ success: true, message: 'Document processing initiated.' });
  } catch (error) {
    console.error('[API Route] Error in POST /api/documents/process:', error);
    // Optional: Implement server-side logging for unexpected errors
    // Use userIdForLogging and documentIdForLogging here
    // if (userIdForLogging) {
    //    await supabase.from('audit_logs').insert({ user_id: userIdForLogging, resource_id: documentIdForLogging, action: 'process_error', ... });
    // }
    return NextResponse.json({ error: 'Internal server error in API route' }, { status: 500 });
  }
}

/**
 * GET /api/documents/process?documentId=xxx
 * Get the processing status of a document
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client using the consistent helper
    const supabase = createServerActionClient();

    // Get current user (getUser uses the async cookie handlers)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from('policy_documents')
      .select('id, title, status')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Count chunks for this document
    const { count, error: countError } = await supabase
      .from('policy_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    if (countError) {
      return NextResponse.json({ error: 'Failed to get processing status' }, { status: 500 });
    }

    return NextResponse.json({
      documentId,
      title: document.title,
      status: document.status,
      processed: count ? count > 0 : false,
      chunkCount: count || 0,
    });
  } catch (error) {
    console.error('Error getting document processing status:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
