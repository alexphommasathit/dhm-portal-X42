# Policy Document Upload Edge Function

This Supabase Edge Function handles secure document uploads for the Policy & Procedures system.

## Features

- Secure file uploads directly to Supabase storage
- Role-based access control (only admin users can upload)
- File validation (type, size)
- Metadata storage in the database
- Error handling and audit logging

## Deployment

To deploy this function:

1. Make sure you have the Supabase CLI installed
2. Log in to Supabase CLI using `supabase login`
3. Run the deployment script:

```bash
cd ../../
./functions/deploy.sh
```

Or deploy manually:

```bash
supabase functions deploy policy-upload
```

## Usage

### Client-side

Use the PolicyUploader utility:

```typescript
import { policyUploader } from '@/lib/policy-uploader';

// Example usage in a form submission handler
async function handleSubmit(formData) {
  try {
    const result = await policyUploader.uploadDocument({
      title: 'My Policy Document',
      description: 'Description of the document',
      file: fileObject, // File object from <input type="file">
      status: 'draft',
      version: '1.0',
      effective_date: new Date(),
      review_date: new Date(),
    });
    
    console.log('Upload successful:', result);
    
    // Process the document to extract text
    await policyUploader.processDocument(result.documentId);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### Testing the API Directly

Using cURL:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/policy-upload \
  -H "Authorization: Bearer USER_AUTH_TOKEN" \
  -F "file=@path/to/file.pdf" \
  -F "title=Test Document" \
  -F "description=Test description" \
  -F "status=draft"
```

## Security

This function implements several security measures:

1. Authentication check - only authenticated users can access
2. Role-based authorization - only users with 'administrator' or 'hr_admin' roles can upload
3. File validation - only allows PDF and Word documents under 10MB
4. Audit logging - all uploads (successful or failed) are logged

## Error Handling

The function returns appropriate HTTP status codes and error messages for different scenarios:

- 401: Unauthorized (not authenticated)
- 403: Forbidden (not an admin)
- 400: Bad Request (invalid file type, size, or missing required fields)
- 500: Internal Server Error (upload or database errors)

Each error response includes a JSON object with an error message and optional details. 