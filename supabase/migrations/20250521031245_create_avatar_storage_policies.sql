-- Create policy for inserting avatars
create policy "Allow authenticated users to upload avatars" on storage.objects for insert with check (
  bucket_id = 'avatars' AND auth.role() = 'authenticated'
);

-- Create policy for updating own avatar
create policy "Allow authenticated users to update own avatar" on storage.objects for update using (
  bucket_id = 'avatars' AND auth.uid() = owner_id::uuid
);

-- Create policy for viewing avatars (public)
create policy "Allow anyone to view avatars" on storage.objects for select using (
  bucket_id = 'avatars'
);
