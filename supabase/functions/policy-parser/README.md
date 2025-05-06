# Policy Document Parsing and Chunking Edge Function

This Supabase Edge Function handles parsing and chunking of policy documents for the P&P (Policies & Procedures) system.

## Features

- PDF text extraction using pdf-parse
- Chunking of documents with configurable size and overlap
- Storage of chunks in the `policy_chunks` table
- Support for both PDF and potentially Word documents
- RBAC security with admin-only access
- Detailed error handling

## Requirements

This function requires the following:

1. A Supabase project with Storage and Database configured
2. A `policy_documents` table for document metadata
3. A `policy_chunks` table for storing the extracted text chunks
4. A `policy-documents` storage bucket containing the files to process

## Deployment

To deploy this function:

```bash
supabase functions deploy policy-parser
```

## Usage

### Client-side

Use the `PolicyParser` client utility:

```typescript
import { policyParser } from '@/lib/policy-parser';

// Process a document
async function processDocument(documentId, filePath) {
  try {
    const totalChunks = await policyParser.parseDocument(documentId, filePath);
    console.log(`Document processed with ${totalChunks} chunks`);
    
    // Retrieve chunks if needed
    const chunks = await policyParser.getDocumentChunks(documentId);
    console.log('Retrieved chunks:', chunks);
  } catch (error) {
    console.error('Processing error:', error);
  }
}
```

### Direct API Call

```typescript
const response = await fetch('https://your-project.supabase.co/functions/v1/policy-parser', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAccessToken}`
  },
  body: JSON.stringify({
    documentId: 'uuid-of-document',
    filePath: 'path/to/file/in/storage.pdf'
  })
});

const result = await response.json();
console.log(result);
```

## Security

This function implements several security measures:

1. Authentication check using Supabase Auth
2. RBAC checks - only users with 'administrator' or 'hr_admin' roles can process documents
3. Document ownership verification

## Chunking Details

Documents are chunked using the following parameters:

- Chunk size: 500 tokens (roughly characters)
- Chunk overlap: 100 tokens

These parameters can be adjusted in the function as needed.

## Error Handling

The function provides detailed error responses including:

- 400: Bad Request (missing fields, unsupported file type)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not an admin)
- 404: Not Found (document not found)
- 500: Internal Server Error (file download or parsing error)
- 501: Not Implemented (for unsupported file types that could be supported in the future)
- 207: Multi-Status (partial success, some chunks may not have been inserted) 