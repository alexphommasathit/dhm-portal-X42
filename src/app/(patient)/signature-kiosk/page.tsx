'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { AlertCircle, Check, Edit3, FileText, Loader2 } from 'lucide-react';

// Dynamically import SignaturePad component with no SSR
const SignaturePad = dynamic(() => import('react-signature-canvas'), { ssr: false });

// Interface for document information
interface DocumentInfo {
  id: string;
  document_name: string;
  document_type: string;
  description: string | null;
  patient_name: string;
}

export default function SignatureKioskPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get('document');
  const patientId = searchParams.get('patient');

  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [signaturePad, setSignaturePad] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  // Fetch document details on load
  useEffect(() => {
    if (!documentId || !patientId) {
      setError('Missing document or patient information');
      setLoading(false);
      return;
    }

    const fetchDocumentInfo = async () => {
      try {
        // Get document info
        const { data: docData, error: docError } = await supabase
          .from('patient_documents')
          .select('id, document_name, document_type, description')
          .eq('id', documentId)
          .eq('patient_id', patientId)
          .eq('document_status', 'pending_signature')
          .single();

        if (docError) throw docError;
        if (!docData) throw new Error('Document not found or already signed');

        // Get patient name
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('first_name, last_name')
          .eq('id', patientId)
          .single();

        if (patientError) throw patientError;

        setDocument({
          ...docData,
          patient_name: `${patientData.first_name} ${patientData.last_name}`,
        });
      } catch (error) {
        console.error('Error fetching document:', error);
        setError('Could not load document. It may not exist or has already been signed.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentInfo();
  }, [documentId, patientId, supabase]);

  const handleClearSignature = () => {
    if (signaturePad) {
      signaturePad.clear();
    }
  };

  const handleSignDocument = async () => {
    if (!signaturePad || !document) {
      setError('No signature provided');
      return;
    }

    if (signaturePad.isEmpty()) {
      setError('Please provide a signature before submitting');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Get signature as data URL
      const signatureDataUrl = signaturePad.toDataURL('image/png');

      // Submit signature
      const { error } = await supabase.rpc('sign_patient_document', {
        p_document_id: document.id,
        p_signed_data: {
          signature_image: signatureDataUrl,
          signed_date: new Date().toISOString(),
          signed_in_person: true,
          signed_by_name: document.patient_name,
          kiosk_mode: true,
        },
      });

      if (error) throw error;

      // Show success state
      setSuccess(true);
    } catch (error) {
      console.error('Error signing document:', error);
      setError('Failed to save signature. Please try again or ask for assistance.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold">Loading document...</h2>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !document) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <CardTitle className="mt-4">Document Not Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-700">{error}</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/signature-kiosk/welcome')}
            >
              Return to Start
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto" />
            <CardTitle className="mt-4">Signature Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-700">
              Thank you. Your document has been signed successfully.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => (window.location.href = '/signature-kiosk/welcome')}>
              Done
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Signature collection UI
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Please Sign Your Document</CardTitle>
          {document && (
            <CardDescription className="text-lg mt-2">{document.document_name}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document info */}
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <div className="flex items-start gap-3">
              <FileText className="h-6 w-6 text-blue-500 mt-1" />
              <div>
                <h3 className="font-medium">Document Information</h3>
                {document && (
                  <>
                    <p className="mt-1">
                      Patient: <span className="font-medium">{document.patient_name}</span>
                    </p>
                    {document.description && (
                      <p className="mt-1 text-sm text-gray-600">{document.description}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Consent text */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <p className="text-sm text-gray-700">
              I, <span className="font-medium">{document?.patient_name}</span>, acknowledge that I
              have reviewed this document and consent to its terms. By signing below, I confirm my
              understanding and agreement.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 p-3 rounded-md border border-red-200 text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          {/* Signature pad */}
          <div className="border rounded-lg p-2 bg-white">
            <p className="text-sm text-gray-500 mb-2 flex items-center">
              <Edit3 className="h-4 w-4 mr-1" />
              Please sign below:
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-md h-[200px] overflow-hidden">
              {typeof window !== 'undefined' && (
                <SignaturePad
                  ref={ref => setSignaturePad(ref)}
                  canvasProps={{
                    className: 'signature-canvas w-full h-full',
                  }}
                  backgroundColor="rgba(255, 255, 255, 0)"
                />
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between flex-wrap gap-4">
          <Button variant="outline" onClick={handleClearSignature}>
            Clear Signature
          </Button>
          <Button onClick={handleSignDocument} disabled={submitting} className="min-w-32">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              'Complete Signature'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
