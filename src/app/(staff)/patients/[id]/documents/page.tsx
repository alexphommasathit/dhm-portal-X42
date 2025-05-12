'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import {
  FileIcon,
  FileText,
  FileUp,
  MoreVertical,
  Download,
  Pen,
  Trash2,
  FileCheck,
  Calendar,
  Edit3,
  FileSymlink,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import SignaturePad component with no SSR to avoid hydration errors
const SignaturePad = dynamic(() => import('react-signature-canvas'), { ssr: false });

// Define document types corresponding to the Postgres enum
const documentTypes = [
  { value: 'admission_form', label: 'Admission Form' },
  { value: 'consent_form', label: 'Consent Form' },
  { value: 'medical_record', label: 'Medical Record' },
  { value: 'insurance_card', label: 'Insurance Card' },
  { value: 'identification', label: 'Identification' },
  { value: 'advance_directive', label: 'Advance Directive' },
  { value: 'care_plan', label: 'Care Plan' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'other', label: 'Other' },
];

// Maps document status to colors for badges
const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending_signature: 'bg-yellow-100 text-yellow-800',
  signed: 'bg-green-100 text-green-800',
  archived: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

// Interface for patient documents
interface PatientDocument {
  id: string;
  document_name: string;
  document_type: string;
  document_status: string;
  file_storage_path: string;
  file_mime_type: string | null;
  file_size: number;
  original_filename: string | null;
  description: string | null;
  requires_signature: boolean;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  version?: number;
}

// Interface for document templates
interface DocumentTemplate {
  id: string;
  template_name: string;
  document_type: string;
  file_storage_path: string;
  description: string | null;
  requires_signature: boolean;
}

export default function PatientDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const patientId = params.id as string;

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  // Form states
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState<string>('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Add state for signature collection
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [signaturePad, setSignaturePad] = useState<React.RefObject<any> | null>(null);
  const [patientName, setPatientName] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<PatientDocument | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<PatientDocument | null>(null);

  // Add state for editing document
  const [editDocumentName, setEditDocumentName] = useState('');
  const [editDocumentType, setEditDocumentType] = useState('');
  const [editDocumentDescription, setEditDocumentDescription] = useState('');
  const [editRequiresSignature, setEditRequiresSignature] = useState(false);

  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [documentToVersion, setDocumentToVersion] = useState<PatientDocument | null>(null);
  const [versioningFile, setVersioningFile] = useState<File | null>(null);
  const [versionUploadProgress, setVersionUploadProgress] = useState(0);

  const supabase = createClient();

  // Fetch patient documents on component mount
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, [patientId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadingFile(file);

    // Automatically set document name to file name if not specified
    if (!documentName) {
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setDocumentName(fileName);
    }
  };

  const uploadDocument = async () => {
    if (!uploadingFile || !documentType) {
      toast({
        title: 'Missing information',
        description: 'Please select a file and document type',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Upload file to storage
      const fileExt = uploadingFile.name.split('.').pop();
      const filePath = `patients/${patientId}/documents/${Date.now()}.${fileExt}`;

      // Use Supabase storage for file upload
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadingFile, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: progress => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          },
        });

      if (uploadError) throw uploadError;

      // Create document record in database
      const { error: documentError } = await supabase.rpc('upload_patient_document', {
        p_patient_id: patientId,
        p_document_name: documentName || uploadingFile.name,
        p_document_type: documentType,
        p_file_storage_path: filePath,
        p_file_mime_type: uploadingFile.type,
        p_file_size: uploadingFile.size,
        p_original_filename: uploadingFile.name,
        p_description: documentDescription,
        p_requires_signature: requiresSignature,
        p_document_status: requiresSignature ? 'pending_signature' : 'draft',
      });

      if (documentError) throw documentError;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

      // Reset form and close dialog
      resetUploadForm();
      setUploadDialogOpen(false);
      fetchDocuments(); // Refresh document list
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  const createFromTemplate = async () => {
    if (!selectedTemplate) {
      toast({
        title: 'Error',
        description: 'Please select a template',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.rpc('create_document_from_template', {
        p_patient_id: patientId,
        p_template_id: selectedTemplate,
        p_document_name: documentName || undefined,
        p_document_status: 'draft',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document created from template',
      });

      // Reset form and close dialog
      resetTemplateForm();
      setTemplateDialogOpen(false);
      fetchDocuments(); // Refresh document list
    } catch (error) {
      console.error('Error creating document from template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create document',
        variant: 'destructive',
      });
    }
  };

  const downloadDocument = async (document: PatientDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.original_filename || document.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download the document',
        variant: 'destructive',
      });
    }
  };

  const signDocument = async (documentId: string) => {
    try {
      const { data, error } = await supabase.rpc('sign_patient_document', {
        p_document_id: documentId,
        p_signed_data: { signed_date: new Date().toISOString() },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document has been signed',
      });

      fetchDocuments(); // Refresh document list
    } catch (error) {
      console.error('Error signing document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign document',
        variant: 'destructive',
      });
    }
  };

  const resetUploadForm = () => {
    setDocumentName('');
    setDocumentType('');
    setDocumentDescription('');
    setRequiresSignature(false);
    setUploadingFile(null);
    setUploadProgress(0);
  };

  const resetTemplateForm = () => {
    setDocumentName('');
    setSelectedTemplate('');
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find(dt => dt.value === type)?.label || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render empty state if no documents
  const renderEmptyState = () => (
    <div className="text-center py-12">
      <FileText className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">No documents yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload documents for this patient or create from templates.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={() => setUploadDialogOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
        <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Use Template
        </Button>
      </div>
    </div>
  );

  // Add function to open signature dialog
  const openSignatureDialog = async (documentId: string) => {
    setCurrentDocumentId(documentId);

    // Get patient name for the consent form
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', patientId)
        .single();

      if (error) throw error;

      if (data) {
        setPatientName(`${data.first_name} ${data.last_name}`);
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
    }

    setSignatureDialogOpen(true);
  };

  // Add function to handle signature submission
  const handleSignatureSubmit = async () => {
    if (!signaturePad || !currentDocumentId) {
      toast({
        title: 'Error',
        description: 'No signature provided',
        variant: 'destructive',
      });
      return;
    }

    if (signaturePad.current?.isEmpty()) {
      toast({
        title: 'Error',
        description: 'Please provide a signature',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get signature as base64 data URL
      const signatureDataUrl = signaturePad.current?.toDataURL('image/png');

      // Save signature to document
      const { error } = await supabase.rpc('sign_patient_document', {
        p_document_id: currentDocumentId,
        p_signed_data: {
          signature_image: signatureDataUrl,
          signed_date: new Date().toISOString(),
          signed_in_person: true,
          signed_by_name: patientName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document signed successfully',
      });

      // Reset and close
      setSignatureDialogOpen(false);
      setCurrentDocumentId(null);
      if (signaturePad.current) signaturePad.current.clear();

      // Refresh documents
      fetchDocuments();
    } catch (error) {
      console.error('Error signing document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign document',
        variant: 'destructive',
      });
    }
  };

  // Add function to clear signature
  const clearSignature = () => {
    if (signaturePad.current) signaturePad.current.clear();
  };

  // Add delete document function
  const deleteDocument = async (document: PatientDocument) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  // Confirm document deletion
  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      // Delete document metadata from database
      const { error: dbError } = await supabase.rpc('delete_patient_document', {
        p_document_id: documentToDelete.id,
      });

      if (dbError) throw dbError;

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([documentToDelete.file_storage_path]);

      if (storageError) {
        console.error('Warning: File deleted from database but not from storage:', storageError);
        // We continue anyway since the database record is gone
      }

      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });

      // Refresh documents and close dialog
      fetchDocuments();
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  // Open edit document dialog
  const editDocument = (document: PatientDocument) => {
    setDocumentToEdit(document);
    setEditDocumentName(document.document_name);
    setEditDocumentType(document.document_type);
    setEditDocumentDescription(document.description || '');
    setEditRequiresSignature(document.requires_signature);
    setEditDialogOpen(true);
  };

  // Update document function
  const updateDocument = async () => {
    if (!documentToEdit) return;

    try {
      const { error } = await supabase.rpc('update_patient_document', {
        p_document_id: documentToEdit.id,
        p_document_name: editDocumentName,
        p_document_type: editDocumentType,
        p_description: editDocumentDescription,
        p_requires_signature: editRequiresSignature,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document updated successfully',
      });

      // Reset form and close dialog
      setEditDialogOpen(false);
      setDocumentToEdit(null);
      fetchDocuments(); // Refresh document list
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update document',
        variant: 'destructive',
      });
    }
  };

  // Handle version file upload
  const handleVersionFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setVersioningFile(file);
  };

  // Upload new version of a document
  const uploadNewVersion = async () => {
    if (!documentToVersion || !versioningFile) {
      toast({
        title: 'Missing information',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Upload file to storage
      const fileExt = versioningFile.name.split('.').pop();
      const filePath = `patients/${patientId}/documents/v${Date.now()}.${fileExt}`;

      // Use Supabase storage for file upload
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, versioningFile, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: progress => {
            setVersionUploadProgress((progress.loaded / progress.total) * 100);
          },
        });

      if (uploadError) throw uploadError;

      // Create new version using RPC function
      const { error: versionError } = await supabase.rpc('version_patient_document', {
        p_document_id: documentToVersion.id,
        p_new_file_storage_path: filePath,
        p_new_file_mime_type: versioningFile.type,
        p_new_file_size: versioningFile.size,
        p_new_original_filename: versioningFile.name,
      });

      if (versionError) throw versionError;

      toast({
        title: 'Success',
        description: 'New document version created successfully',
      });

      // Reset form and close dialog
      setVersioningFile(null);
      setVersionUploadProgress(0);
      setVersionDialogOpen(false);
      setDocumentToVersion(null);
      fetchDocuments(); // Refresh document list
    } catch (error) {
      console.error('Error creating new version:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create new version',
        variant: 'destructive',
      });
    } finally {
      setVersionUploadProgress(0);
    }
  };

  // Function to setup document versioning
  const versionDocument = (document: PatientDocument) => {
    setDocumentToVersion(document);
    setVersionDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patient Documents</h1>
        <div className="flex gap-2">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Use Template
          </Button>
          <Button variant="outline" onClick={() => router.push(`/patients/${patientId}`)}>
            Back to Patient
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="pending">Pending Signature</TabsTrigger>
          <TabsTrigger value="signed">Signed</TabsTrigger>
          <TabsTrigger value="templates">Form Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {loading ? (
            <div className="text-center py-12">Loading documents...</div>
          ) : documents.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map(doc => (
                <Card key={doc.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{doc.document_name}</CardTitle>
                        <CardDescription>{getDocumentTypeLabel(doc.document_type)}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          {doc.document_status === 'pending_signature' && (
                            <DropdownMenuItem onClick={() => signDocument(doc.id)}>
                              <Pen className="mr-2 h-4 w-4" />
                              Sign Document
                            </DropdownMenuItem>
                          )}
                          {doc.document_status !== 'signed' && (
                            <DropdownMenuItem onClick={() => editDocument(doc)}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => versionDocument(doc)}>
                            <FileSymlink className="mr-2 h-4 w-4" />
                            Upload New Version
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteDocument(doc)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {doc.description && (
                      <p className="text-sm text-gray-500 mt-2 mb-3">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          statusColors[doc.document_status as keyof typeof statusColors] ||
                          'bg-gray-100'
                        }`}
                      >
                        {doc.document_status.replace('_', ' ')}
                      </span>
                      {doc.requires_signature && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          Requires Signature
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 flex justify-between items-center text-xs text-gray-500 border-t">
                    <div className="flex items-center">
                      <FileIcon className="mr-1 h-3 w-3" />
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-3 w-3" />
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {loading ? (
            <div className="text-center py-12">Loading documents...</div>
          ) : documents.filter(d => d.document_status === 'pending_signature').length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No documents pending signature
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(d => d.document_status === 'pending_signature')
                .map(doc => (
                  <Card key={doc.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{doc.document_name}</CardTitle>
                          <CardDescription>
                            {getDocumentTypeLabel(doc.document_type)}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => openSignatureDialog(doc.id)}
                            variant="default"
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Collect Signature
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {doc.description && (
                        <p className="text-sm text-gray-500 mt-2 mb-3">{doc.description}</p>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 flex justify-between items-center text-xs text-gray-500 border-t">
                      <div className="flex items-center">
                        <FileIcon className="mr-1 h-3 w-3" />
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signed">
          {loading ? (
            <div className="text-center py-12">Loading documents...</div>
          ) : documents.filter(d => d.document_status === 'signed').length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No signed documents</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(d => d.document_status === 'signed')
                .map(doc => (
                  <Card key={doc.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{doc.document_name}</CardTitle>
                          <CardDescription>
                            {getDocumentTypeLabel(doc.document_type)}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => downloadDocument(doc)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {doc.description && (
                        <p className="text-sm text-gray-500 mt-2 mb-3">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Signed
                        </span>
                        {doc.signed_at && (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            {formatDate(doc.signed_at)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 flex justify-between items-center text-xs text-gray-500 border-t">
                      <div className="flex items-center">
                        <FileIcon className="mr-1 h-3 w-3" />
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No templates available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Document templates need to be defined by an administrator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(template => (
                <Card key={template.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{template.template_name}</CardTitle>
                        <CardDescription>
                          {getDocumentTypeLabel(template.document_type)}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setTemplateDialogOpen(true);
                        }}
                      >
                        Use Template
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-2">{template.description}</p>
                    )}
                    {template.requires_signature && (
                      <div className="mt-2">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          Requires Signature
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document file for this patient. Supported formats: PDF, DOC, DOCX, JPG, PNG.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              {uploadingFile && (
                <div className="text-xs text-gray-500 mt-1">
                  {uploadingFile.name} ({formatFileSize(uploadingFile.size)})
                </div>
              )}

              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentName">Document Name</Label>
              <Input
                id="documentName"
                value={documentName}
                onChange={e => setDocumentName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="documentType">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentDescription">Description (Optional)</Label>
              <Textarea
                id="documentDescription"
                value={documentDescription}
                onChange={e => setDocumentDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requiresSignature"
                checked={requiresSignature}
                onChange={() => setRequiresSignature(!requiresSignature)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="requiresSignature">Requires signature</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={uploadDocument} disabled={!uploadingFile || !documentType}>
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Document from Template</DialogTitle>
            <DialogDescription>
              Select a template to create a new document for this patient.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name} ({getDocumentTypeLabel(template.document_type)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentName">Document Name (Optional)</Label>
              <Input
                id="documentName"
                value={documentName}
                onChange={e => setDocumentName(e.target.value)}
                placeholder="Leave blank to use template name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFromTemplate} disabled={!selectedTemplate}>
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add new Signature Collection Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Collect Patient Signature</DialogTitle>
            <DialogDescription>
              Have the patient sign below to authorize this document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-md bg-gray-50">
              <p className="text-sm text-gray-700 mb-2">
                I, <span className="font-medium">{patientName}</span>, acknowledge that I have
                reviewed this document and consent to its terms.
              </p>
              <p className="text-sm text-gray-700">
                By signing below, I confirm my understanding and agreement.
              </p>
            </div>

            <div className="border rounded-md p-1 bg-white">
              <div className="border-2 border-dashed border-gray-300 rounded h-[200px] flex items-center justify-center overflow-hidden">
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

            <div className="flex justify-end">
              <Button variant="outline" onClick={clearSignature} size="sm">
                Clear Signature
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setSignatureDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSignatureSubmit}>Complete Signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {documentToDelete && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FileText className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {documentToDelete.document_name}
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Type: {getDocumentTypeLabel(documentToDelete.document_type)}</p>
                      {documentToDelete.description && (
                        <p className="mt-1">{documentToDelete.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDocument}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document information. You cannot edit signed documents.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editDocumentName">Document Name</Label>
              <Input
                id="editDocumentName"
                value={editDocumentName}
                onChange={e => setEditDocumentName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDocumentType">Document Type</Label>
              <Select value={editDocumentType} onValueChange={setEditDocumentType}>
                <SelectTrigger id="editDocumentType">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDocumentDescription">Description (Optional)</Label>
              <Textarea
                id="editDocumentDescription"
                value={editDocumentDescription}
                onChange={e => setEditDocumentDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editRequiresSignature"
                checked={editRequiresSignature}
                onChange={() => setEditRequiresSignature(!editRequiresSignature)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="editRequiresSignature">Requires signature</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateDocument}>Update Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Version Dialog after Edit Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version of &quot;{documentToVersion?.document_name}&quot;. The previous
              version will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="versionFile">Select New File</Label>
              <Input
                id="versionFile"
                type="file"
                onChange={handleVersionFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              {versioningFile && (
                <div className="text-xs text-gray-500 mt-1">
                  {versioningFile.name} ({formatFileSize(versioningFile.size)})
                </div>
              )}

              {versionUploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${versionUploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>

            {documentToVersion && (
              <div className="rounded-md bg-blue-50 p-4 mt-2">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FileText className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Current Document Information
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>Name: {documentToVersion.document_name}</p>
                      <p>Type: {getDocumentTypeLabel(documentToVersion.document_type)}</p>
                      <p>Version: {documentToVersion.version || 1}</p>
                      {documentToVersion.description && (
                        <p className="mt-1">Description: {documentToVersion.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={uploadNewVersion} disabled={!versioningFile}>
              Upload New Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
