# getPolicyChunksByIds

This Supabase Edge Function retrieves policy chunks by their IDs from the `policy_chunks` table. It's designed to be used by authenticated users who need to access policy content associated with specific chunk IDs, for example in a workflow or documentation context.

## Authentication

The function requires an authenticated user. Authentication is done via the Supabase Auth system, with the client passing the user's JWT token in the `Authorization` header.

## API

### Endpoint

```
POST /functions/v1/getPolicyChunksByIds
```

### Headers

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body

```json
{
  "chunkIds": ["chunk_id_1", "chunk_id_2", "chunk_id_3", ...]
}
```

| Parameter | Type     | Description                              |
|-----------|----------|------------------------------------------|
| chunkIds  | string[] | Array of policy chunk IDs to retrieve    |

### Response

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "chunk_id": "chunk_id_1",
      "content": "Policy content text...",
      "source": "Policy Title or Filename"
    },
    {
      "chunk_id": "chunk_id_2",
      "content": "More policy content...",
      "source": "Another Policy Title"
    }
  ],
  "count": 2,
  "requested": 2
}
```

#### Error Responses

##### Unauthorized (401)
```json
{
  "error": "Unauthorized: User not authenticated"
}
```

##### Bad Request (400)
```json
{
  "error": "Missing or invalid chunkIds parameter. Expected non-empty array of string IDs."
}
```

##### Internal Server Error (500)
```json
{
  "error": "Failed to retrieve policy chunks",
  "details": "Error message details..."
}
```

## Usage Example

### Client-side (JavaScript/TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getPolicyContent(chunkIds: string[]) {
  try {
    const { data, error } = await supabase.functions.invoke('getPolicyChunksByIds', {
      body: { chunkIds }
    });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching policy chunks:', error);
    throw error;
  }
}

// Example usage
const policyData = await getPolicyContent(['chunk1', 'chunk2']);
console.log(policyData);
```

## Deployment

Deploy this function to your Supabase project using the Supabase CLI:

```bash
supabase functions deploy getPolicyChunksByIds --project-ref your-project-ref
```

## Security Considerations

- The function only returns policy chunks that exist in the database
- It requires valid authentication
- For additional security, you can implement RBAC by checking the user's role in the profiles table
- Chunk IDs are validated to ensure they're strings before querying the database 