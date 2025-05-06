import { createClientComponentSupabase } from '@/lib/supabase/client';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '@/types/policy-document';
import { auditLogger } from './audit-logger';

/**
 * Service for parsing, processing, and chunking document content
 */
export class DocumentProcessor {
  private supabase = createClientComponentSupabase();

  /**
   * Process a document from Supabase storage, extract text, and chunk it
   *
   * @param documentId - The ID of the document in the database
   * @param userId - The ID of the user initiating the processing
   * @returns boolean indicating success or failure
   */
  async processDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      // First, get the document metadata
      const { data: document, error: docError } = await this.supabase
        .from('policy_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Error fetching document:', docError);
        return false;
      }

      // Log the processing attempt
      await auditLogger.logEvent({
        user_id: userId,
        action: 'process',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: {
          title: document.title,
          file_path: document.file_path,
        },
        success: true,
      });

      // Get the file from storage
      const { data: fileData, error: fileError } = await this.supabase.storage
        .from('policy-documents')
        .download(document.file_path);

      if (fileError || !fileData) {
        console.error('Error downloading file:', fileError);
        return false;
      }

      // Extract text based on file type
      let text = '';
      if (document.file_type === 'application/pdf') {
        text = await this.extractTextFromPdf(/* file: Blob */);
      } else if (
        document.file_type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        document.file_type === 'application/msword'
      ) {
        text = await this.extractTextFromDocx(/* file: Blob */);
      } else {
        console.error('Unsupported file type:', document.file_type);
        return false;
      }

      // Create chunks from the extracted text
      const chunks = this.createChunks(text);

      // Delete any existing chunks for this document
      const { error: deleteError } = await this.supabase
        .from('policy_chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        console.error('Error deleting existing chunks:', deleteError);
      }

      // Insert new chunks
      for (let i = 0; i < chunks.length; i++) {
        const { error: insertError } = await this.supabase.from('policy_chunks').insert({
          document_id: documentId,
          chunk_index: i,
          chunk_text: chunks[i],
          metadata: {
            title: document.title,
            document_status: document.status,
            chunk_number: i + 1,
            total_chunks: chunks.length,
          },
        });

        if (insertError) {
          console.error(`Error inserting chunk ${i}:`, insertError);
        }
      }

      console.log(`Successfully processed document ${documentId} into ${chunks.length} chunks`);
      return true;
    } catch (err) {
      console.error('Error processing document:', err);
      return false;
    }
  }

  /**
   * Extract text from a PDF file
   *
   * @param file - PDF file blob
   * @returns Extracted text
   */
  private async extractTextFromPdf(/* file: Blob */): Promise<string> {
    try {
      // In a real implementation, you'd use pdf-parse or a similar library
      // Since we can't import external libraries here, we'll simulate the extraction

      // Normally you'd do something like:
      // const pdfParse = require('pdf-parse');
      // const data = await pdfParse(Buffer.from(await file.arrayBuffer()));
      // return data.text;

      // For demonstration, we'll return a placeholder
      return `This is placeholder text for a PDF document. 
              In a real implementation, you would use a library like pdf-parse
              to extract the actual text content from the PDF file.
              This would then be chunked and stored in the database.`;
    } catch (err) {
      console.error('Error extracting text from PDF:', err);
      return '';
    }
  }

  /**
   * Extract text from a DOCX file
   *
   * @param file - DOCX file blob
   * @returns Extracted text
   */
  private async extractTextFromDocx(/* file: Blob */): Promise<string> {
    try {
      // In a real implementation, you'd use mammoth or similar library
      // Since we can't import external libraries here, we'll simulate the extraction

      // Normally you'd do something like:
      // const mammoth = require('mammoth');
      // const result = await mammoth.extractRawText({
      //   arrayBuffer: await file.arrayBuffer()
      // });
      // return result.value;

      // For demonstration, we'll return a placeholder
      return `This is placeholder text for a Word document. 
              In a real implementation, you would use a library like mammoth
              to extract the actual text content from the DOCX file.
              This would then be chunked and stored in the database.`;
    } catch (err) {
      console.error('Error extracting text from DOCX:', err);
      return '';
    }
  }

  /**
   * Create text chunks from a document
   *
   * @param text - The full text to chunk
   * @returns Array of text chunks
   */
  private createChunks(text: string): string[] {
    if (!text) return [];

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Calculate end index for current chunk
      const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);

      // Extract chunk
      const chunk = text.substring(startIndex, endIndex);
      chunks.push(chunk);

      // Move start index for next chunk, accounting for overlap
      startIndex = endIndex - CHUNK_OVERLAP;

      // If we've reached the end of the text, break
      if (startIndex >= text.length) break;

      // Avoid tiny chunks at the end
      if (text.length - startIndex < CHUNK_SIZE / 4) {
        chunks.push(text.substring(startIndex));
        break;
      }
    }

    return chunks;
  }
}

export const documentProcessor = new DocumentProcessor();
