import { Database } from './supabase';

// Define policy document status types
export type PolicyDocumentStatus = 'draft' | 'review' | 'published' | 'archived';

// TypeScript type for policy document from database
export type PolicyDocument = Database['public']['Tables']['policy_documents']['Row'];

// Type for creating a new policy document
export type PolicyDocumentInsert = Database['public']['Tables']['policy_documents']['Insert'];

// Type for updating a policy document
export type PolicyDocumentUpdate = Database['public']['Tables']['policy_documents']['Update'];

// TypeScript type for policy document chunk from database (would be defined once the table is created)
export interface PolicyChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  metadata: Record<string, any>;
  embedding?: number[];
  created_at: string;
}

// Define document upload form type
export interface PolicyDocumentForm {
  title: string;
  description?: string;
  file: File | null;
  version?: string;
  status: PolicyDocumentStatus;
  effective_date?: Date | null;
  review_date?: Date | null;
}

// Allowed file types for policy documents
export const ALLOWED_FILE_TYPES = [
  'application/pdf', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword' // .doc
];

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Chunking configuration
export const CHUNK_SIZE = 1000; // characters per chunk
export const CHUNK_OVERLAP = 200; // characters of overlap between chunks 