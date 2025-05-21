'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import Link from 'next/link';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type Role = Database['public']['Enums']['user_role'];

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  // State for active tab
  const [activeTab, setActiveTab] = useState('overview');

  // State for active info sub-tab
  const [activeInfoTab, setActiveInfoTab] = useState('personal');

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null); // Ref for the hidden file input

  // Image cropping state
  const [src, setSrc] = useState<string | null>(null); // Source for the image cropper
  const [crop, setCrop] = useState<Crop>(); // Crop state
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>(); // Final cropped pixels
  const imgRef = useRef<HTMLImageElement>(null); // Ref for the image in the cropper
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); // Ref for the preview canvas

  // Form state
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [preferredName, setPreferredName] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // State for role editing
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [committees, setCommittees] = useState<string>('');

  const supabase = createClientComponentSupabase();

  // Role display names for better readability
  const roleDisplayNames: Record<Role, string> = {
    financial_admin: 'Financial Admin',
    clinician: 'Clinician',
    assistant: 'Assistant',
    hr_admin: 'HR Admin',
    administrator: 'Administrator',
    hha: 'Home Health Aide',
    patient: 'Patient',
    /* @ts-expect-error: 'family_caregiver' might not exist in Role enum */
    family_caregiver: 'Family Caregiver',
    case_manager: 'Case Manager',
    referral_source: 'Referral Source',
    unassigned: 'Unassigned',
  };

  // Move handleSubmit function declaration here, before effects and callbacks that use it
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      console.log('[handleSubmit] Function entered.');
      console.log(
        '[handleSubmit] Debug values: gender=',
        gender,
        ', profile?.gender=',
        profile?.gender
      );
      e?.preventDefault(); // Use optional chaining to only call preventDefault if e exists

      if (!user) {
        setMessage({
          type: 'error',
          text: 'You must be logged in to update your profile',
        });
        return;
      }

      setIsLoading(true); // Set main loading state
      setIsUploadingAvatar(true); // Set avatar uploading state initially
      setMessage(null);

      console.log('[handleSubmit] Starting profile update...');
      console.log('[handleSubmit] Current profile:', profile);
      console.log('[handleSubmit] Form state:', {
        firstName,
        lastName,
        birthdate,
        preferredName,
        gender,
        avatarFile,
        avatarUrl,
        jobTitle,
        committees,
      });

      try {
        let newAvatarUrl = profile?.avatar_url ?? null;

        // Handle avatar upload if a new file is selected
        if (avatarFile && user) {
          console.log('[handleSubmit] Avatar file selected. Starting upload...');
          const fileExt = avatarFile.name.split('.').pop();
          const newFilename = `${user.id}.${fileExt}`;
          const filePath = `avatars/${newFilename}`;

          console.log('[handleSubmit] Uploading file to:', filePath);
          // Upload the file
          const { error: uploadError } = await supabase.storage
            .from('avatars') // Replace with your storage bucket name
            .upload(filePath, avatarFile, {
              cacheControl: '3600',
              upsert: true, // Overwrite existing file with the same name
            });

          if (uploadError) {
            console.error('[handleSubmit] Supabase upload error:', uploadError);
            throw uploadError;
          }

          console.log('[handleSubmit] Upload successful. Getting public URL...');
          // Get the public URL of the uploaded file
          const { data: publicUrlData } = supabase.storage
            .from('avatars') // Replace with your storage bucket name
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            console.log('[handleSubmit] Public URL obtained:', publicUrlData.publicUrl);
            newAvatarUrl = publicUrlData.publicUrl;
            // Update the user's avatar_url in auth.users metadata
            console.log('[handleSubmit] Updating auth user metadata with new avatar_url...');
            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: { avatar_url: newAvatarUrl },
            });

            if (authUpdateError) {
              console.error('[handleSubmit] Error updating auth user metadata:', authUpdateError);
              // Decide how to handle this - maybe show a partial success message?
            } else {
              console.log('[handleSubmit] Auth user metadata updated.');
            }
          }
        }

        // Update profile data (including potentially new avatarUrl if you store it in profiles table)
        const profileUpdate: {
          first_name?: string;
          last_name?: string;
          birthdate?: string | null;
          preferred_name?: string | null;
          gender?: string | null;
          avatar_url?: string | null;
          updated_at: string;
          role?: Role;
          job_title?: string | null;
          committees?: string | null;
        } = {
          updated_at: new Date().toISOString(),
        };

        if (firstName !== (profile?.first_name || '')) {
          console.log('[handleSubmit] First name changed:', firstName);
          profileUpdate.first_name = firstName;
        }
        if (lastName !== (profile?.last_name || '')) {
          console.log('[handleSubmit] Last name changed:', lastName);
          profileUpdate.last_name = lastName;
        }
        const currentBirthdate = birthdate || null;
        const profileBirthdate = profile?.birthdate || null;
        if (currentBirthdate !== profileBirthdate) {
          console.log('[handleSubmit] Birthdate changed:', currentBirthdate);
          profileUpdate.birthdate = currentBirthdate;
        }

        // Check and add preferred_name to update object if changed
        const currentPreferredName = preferredName || null;
        const profilePreferredName = profile?.preferred_name || null;
        if (currentPreferredName !== profilePreferredName) {
          console.log('[handleSubmit] Preferred name changed:', currentPreferredName);
          profileUpdate.preferred_name = currentPreferredName;
        }

        // Check and add gender to update object if changed
        const currentGender = gender || null;
        const profileGender = profile?.gender || null;
        console.log(
          '[handleSubmit] Checking gender change: currentGender=',
          currentGender,
          ', profileGender=',
          profileGender
        );
        if (currentGender !== profileGender) {
          console.log('[handleSubmit] Gender changed detected:', currentGender);
          profileUpdate.gender = currentGender;
        }

        // Check and add role to update object if changed
        const currentRole = selectedRole || null;
        const profileRole = profile?.role || null;
        if (currentRole !== profileRole) {
          console.log('[handleSubmit] Role changed:', currentRole);
          profileUpdate.role = currentRole as Role;
        }

        // Check and add job_title to update object if changed
        const currentJobTitle = jobTitle || null;
        const profileJobTitle = profile?.job_title || null;
        if (currentJobTitle !== profileJobTitle) {
          console.log('[handleSubmit] Job title changed:', currentJobTitle);
          profileUpdate.job_title = currentJobTitle;
        }

        // Check and add committees to update object if changed
        const currentCommittees = committees || null;
        const profileCommittees = profile?.committees || null;
        if (currentCommittees !== profileCommittees) {
          console.log('[handleSubmit] Committees changed:', currentCommittees);
          profileUpdate.committees = currentCommittees;
        }

        console.log(
          '[handleSubmit] profileUpdate after checking individual fields:',
          profileUpdate
        );
        console.log('[handleSubmit] Final profileUpdate object:', profileUpdate);

        // Only update profile table if there are changes
        if (
          Object.keys(profileUpdate).length > 1 ||
          (Object.keys(profileUpdate).length === 1 && profileUpdate.avatar_url !== undefined)
        ) {
          console.log('[handleSubmit] Profile data changes detected. Updating profile table...');
          console.log('[handleSubmit] Attempting Supabase profile update...');
          // > 1 because updated_at is always included, or 1 if only avatar_url changed and stored in profiles
          const { error: profileError } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', user.id);

          if (profileError) {
            console.error('[handleSubmit] Supabase profile update error:', profileError);
            throw profileError;
          }
          console.log('[handleSubmit] Profile table updated.');
        }

        setMessage({
          type: 'success',
          text: avatarFile
            ? 'Profile and avatar updated successfully!'
            : 'Profile updated successfully!',
        });

        // Clear the selected avatar file after successful upload
        setAvatarFile(null);

        await refreshProfile(); // Refresh profile to get latest data and avatar_url
        console.log('[handleSubmit] Profile refreshed.');

        setIsEditing(false);
        console.log('[handleSubmit] isEditing set to false.');
      } catch (error: unknown) {
        console.error('[handleSubmit] Caught error during update:', error);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to update profile or avatar',
        });
      } finally {
        console.log('[handleSubmit] Finally block reached.');
        setIsLoading(false);
        setIsUploadingAvatar(false); // Ensure avatar uploading state is false
        console.log('[handleSubmit] Loading states set to false.');
      }
    },
    [
      user,
      profile,
      firstName,
      lastName,
      birthdate,
      avatarFile,
      avatarUrl,
      supabase,
      refreshProfile,
      gender,
      preferredName,
      jobTitle,
      committees,
    ]
  );

  // Helper function to calculate age from birthdate string (YYYY-MM-DD)
  const calculateAge = (birthdate: string | null | undefined): string => {
    if (!birthdate) return 'Not set';
    try {
      const today = new Date();
      const birthDate = new Date(birthdate);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? `${age} years old` : 'Invalid date';
    } catch (error) {
      console.error('Error calculating age:', error);
      return 'Invalid date';
    }
  };

  // Helper function to calculate time at company from start date string
  const calculateTenure = (startDate: string | null | undefined): string => {
    if (!startDate) return 'Not set';
    try {
      const today = new Date();
      const start = new Date(startDate);
      const diffMonths =
        (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());

      if (diffMonths < 0) return 'Invalid date';

      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;

      const parts = [];
      if (years > 0) {
        parts.push(`${years} year${years > 1 ? 's' : ''}`);
      }
      if (months > 0) {
        parts.push(`${months} month${months > 1 ? 's' : ''}`);
      }

      return parts.length > 0 ? parts.join(', ') : 'Less than a month';
    } catch (error) {
      console.error('Error calculating tenure:', error);
      return 'Invalid date';
    }
  };

  useEffect(() => {
    if (profile) {
      console.log('[ProfilePage] Profile data loaded:', profile);
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setBirthdate(
        profile.birthdate ? new Date(profile.birthdate).toISOString().split('T')[0] : ''
      );
      setPreferredName(profile.preferred_name || '');
      setGender(profile.gender || '');
      // Initialize avatarUrl state from profile if available
      setAvatarUrl(profile?.avatar_url ?? null);
      // Initialize selectedRole for editing from profile
      setSelectedRole(profile?.role || '');
      setJobTitle(profile?.job_title || '');
      setCommittees(profile?.committees || '');
      console.log('[ProfilePage] Initial form state:', {
        firstName: profile.first_name,
        lastName: profile.last_name,
        birthdate: profile.birthdate,
        preferredName: profile.preferred_name,
        gender: profile.gender,
        avatarUrl: profile?.avatar_url,
        selectedRole: profile?.role,
        jobTitle: profile?.job_title,
        committees: profile?.committees,
      });
    }
  }, [profile]);

  // Effect to set a default crop when the image is loaded
  useEffect(() => {
    if (src && imgRef.current) {
      const image = imgRef.current;

      // Calculate a centered square crop (1:1 aspect ratio)
      const newCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 80, // Start with 80% width
          },
          1, // 1:1 aspect ratio
          image.naturalWidth, // Image original width
          image.naturalHeight // Image original height
        ),
        image.naturalWidth,
        image.naturalHeight
      );
      setCrop(newCrop);
    }
  }, [src]); // Depend on src changing

  // Helper function to draw the cropped image onto a canvas
  const canvasPreview = async (
    image: HTMLImageElement,
    crop: PixelCrop,
    scale = 1,
    rotate = 0
  ): Promise<Blob | null> => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!ctx || !canvas) {
      throw new Error('No 2d context or canvas element found');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    // devicePixelRatio is important for HiDPI displays
    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.floor(crop.width * scaleX * pixelRatio * scale);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio * scale);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    const rotateRads = rotate * (Math.PI / 180);
    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();

    // 5) Move the crop origin to the canvas origin (0,0) for the subsequent transformations
    ctx.translate(-cropX, -cropY);
    // 4) Move the canvas origin to the center of the original image
    ctx.translate(centerX, centerY);
    // 3) Rotate around the center
    ctx.rotate(rotateRads);
    // 2) Scale data
    ctx.scale(scale, scale);
    // 1) Move the center of the original image to the canvas origin (0,0)
    ctx.translate(-centerX, -centerY);

    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight
    );

    ctx.restore();

    return new Promise(resolve => {
      canvas.toBlob(
        blob => {
          resolve(blob);
        },
        'image/png',
        1
      );
    });
  };

  // Effect to generate the cropped image blob when the crop is completed and handle upload
  useEffect(() => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current && user) {
      console.log(
        '[ProfilePage] Completed crop and image ref ready. Generating blob and uploading...'
      );
      setIsUploadingAvatar(true); // Indicate avatar upload is starting
      canvasPreview(
        imgRef.current,
        completedCrop,
        1 // Scale factor (can adjust for desired output size)
      ).then(async blob => {
        // Make this async to use await inside
        if (blob) {
          // Convert Blob to File
          const croppedFile = new File([blob], 'avatar.png', { type: 'image/png' });
          setAvatarFile(croppedFile); // Set avatarFile state

          const fileExt = croppedFile.name.split('.').pop();
          const newFilename = `${user.id}.${fileExt}`;
          const filePath = `avatars/${newFilename}`;

          console.log('[ProfilePage] Uploading file to:', filePath);
          // Upload the file
          const { error: uploadError } = await supabase.storage
            .from('avatars') // Replace with your storage bucket name
            .upload(filePath, croppedFile, {
              cacheControl: '3600',
              upsert: true, // Overwrite existing file with the same name
            });

          if (uploadError) {
            console.error('[ProfilePage] Supabase upload error:', uploadError);
            setMessage({
              type: 'error',
              text: uploadError.message,
            });
            setIsUploadingAvatar(false); // End uploading state on error
            return; // Stop execution if upload fails
          }

          console.log('[ProfilePage] Upload successful. Getting public URL...');
          // Get the public URL of the uploaded file
          const { data: publicUrlData } = supabase.storage
            .from('avatars') // Replace with your storage bucket name
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            console.log('[ProfilePage] Public URL obtained:', publicUrlData.publicUrl);
            // Update the user's avatar_url in auth.users metadata
            console.log('[ProfilePage] Updating auth user metadata with new avatar_url...');
            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: { avatar_url: publicUrlData.publicUrl },
            });

            if (authUpdateError) {
              console.error('[ProfilePage] Error updating auth user metadata:', authUpdateError);
              setMessage({
                type: 'error',
                text: authUpdateError.message,
              });
            } else {
              console.log('[ProfilePage] Auth user metadata updated.');
              // Set the new avatar URL for immediate preview on success
              setAvatarUrl(publicUrlData.publicUrl);
              setMessage({
                type: 'success',
                text: 'Avatar updated successfully!',
              });
              // Clear crop state after successful upload
              setSrc(null);
              setCrop(undefined);
              setCompletedCrop(undefined);
            }
          } else {
            console.error('[ProfilePage] Failed to get public URL.');
            setMessage({
              type: 'error',
              text: 'Failed to get public URL for avatar.',
            });
          }
        } else {
          console.error('[ProfilePage] Canvas preview failed to generate blob.');
          setMessage({
            type: 'error',
            text: 'Failed to generate avatar image.',
          });
        }
        setIsUploadingAvatar(false); // End uploading state
      });
    }
    // Clean up the temporary URL created by URL.createObjectURL
    return () => {
      if (avatarUrl && avatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [completedCrop, user, supabase]); // Depend on completedCrop, user, and supabase

  // Check if the form has changes compared to the current profile (Update needed for new fields)
  const hasChanges = useCallback(() => {
    if (!profile) return false;

    // Check first name, last name, birthdate, and avatar
    const firstNameChanged = firstName !== (profile.first_name || '');
    const lastNameChanged = lastName !== (profile.last_name || '');
    const currentBirthdate = birthdate || null;
    const profileBirthdate = profile.birthdate || null;
    const birthdateChanged = currentBirthdate !== profileBirthdate;
    const currentPreferredName = preferredName || null;
    const profilePreferredName = profile.preferred_name || null;
    const preferredNameChanged = currentPreferredName !== profilePreferredName;
    const currentGender = gender || null;
    const profileGender = profile.gender || null;
    const genderChanged = currentGender !== profileGender;
    // Check if a new avatar file has been selected
    const avatarChanged = avatarFile !== null;

    // Check if the selected role has changed
    const currentRole = selectedRole || null;
    const profileRole = profile.role || null;
    const roleChanged = currentRole !== profileRole;

    // Check if job title has changed
    const currentJobTitle = jobTitle || null;
    const profileJobTitle = profile.job_title || null;
    const jobTitleChanged = currentJobTitle !== profileJobTitle;

    // Check if committees have changed
    const currentCommittees = committees || null;
    const profileCommittees = profile.committees || null;
    const committeesChanged = currentCommittees !== profileCommittees;

    // Check if avatarUrl has changed if no new file is selected (e.g., if fetching updated profile changed it)
    const profileAvatarUrl = profile?.avatar_url ?? null;
    const avatarUrlChanged = avatarFile === null && avatarUrl !== profileAvatarUrl;

    return (
      firstNameChanged ||
      lastNameChanged ||
      birthdateChanged ||
      preferredNameChanged ||
      genderChanged ||
      roleChanged ||
      jobTitleChanged ||
      committeesChanged ||
      avatarChanged ||
      avatarUrlChanged
    );
  }, [
    firstName,
    lastName,
    birthdate,
    profile,
    avatarFile,
    avatarUrl,
    preferredName,
    gender,
    selectedRole,
    jobTitle,
    committees,
  ]);

  useEffect(() => {
    console.log('[ProfilePage] Form state changed. Checking for changes...');
    console.log('[ProfilePage] Current form state:', {
      firstName,
      lastName,
      birthdate,
      avatarFile,
      avatarUrl,
      selectedRole,
      jobTitle,
      committees,
    });
    console.log('[ProfilePage] Has changes:', hasChanges());
  }, [
    firstName,
    lastName,
    birthdate,
    profile,
    hasChanges,
    avatarFile,
    avatarUrl,
    selectedRole,
    jobTitle,
    committees,
  ]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Basic file type validation
      // Add more sophisticated file validation here (size, type)
      setAvatarFile(file);
      // Create a FileReader to read the file content as a Data URL
      const reader = new FileReader();
      reader.addEventListener('load', () => setSrc(reader.result?.toString() ?? null));
      reader.readAsDataURL(file);
      // Optional: Create and set a temporary preview URL for immediate feedback
      // setAvatarUrl(URL.createObjectURL(file)); // We'll handle preview via the cropper/canvas now
    } else {
      setAvatarFile(null);
      setSrc(null); // Clear source if file is invalid or cancelled
      setCrop(undefined); // Clear crop state
      setCompletedCrop(undefined); // Clear completed crop
      // Revert avatarUrl to profile?.avatar_url or a default if file selection is cancelled
      setAvatarUrl(profile?.avatar_url ?? null);
    }
  };

  // Trigger file input click
  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click();
  };

  // If still loading the user's data
  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in
  if (!user) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-center mb-4">Profile</h2>
            <p className="text-center text-gray-500 mb-4">
              You need to be logged in to view your profile.
            </p>
            <div className="flex justify-center">
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Profile Layout
  return (
    <div className="container mx-auto p-4">
      {/* Profile Header Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {/* Clickable Avatar */}
            <div
              className="w-16 h-16 rounded-full bg-gray-300 mr-4 cursor-pointer flex items-center justify-center overflow-hidden"
              onClick={triggerAvatarUpload}
              title={isUploadingAvatar ? 'Uploading...' : 'Click to upload new avatar'}
            >
              {isUploadingAvatar ? (
                // Placeholder for uploading state
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </div>
            {/* Hidden file input */}
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              disabled={isUploadingAvatar}
            />
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h1>
              <p className="text-sm font-medium text-gray-500">
                {profile?.job_title || 'Not set'} -{' '}
                {roleDisplayNames[profile?.role || 'unassigned']}
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Actions
          </button>
        </div>
        {/* Tabbed Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'workflows'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Workflows
            </button>
            <button
              onClick={() => setActiveTab('role')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'role'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Role
            </button>
            <button
              onClick={() => setActiveTab('change-log')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'change-log'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Change Log
            </button>
            {/* Add other tabs as needed */}
          </nav>
        </div>
      </div>

      {/* Avatar Cropper and Preview Section */}
      {src && ( // Only show cropper if an image source is loaded
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Crop Avatar</h3>
          <div className="flex flex-col items-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={c => setCompletedCrop(c)}
              aspect={1}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} alt="Crop me" src={src} onLoad={() => {}} className="max-h-96" />
            </ReactCrop>
            {completedCrop && ( // Show preview if crop is completed
              <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-900 mb-1">Preview</h4>
                <canvas
                  ref={previewCanvasRef}
                  // Set canvas size to desired output size (e.g., 200x200)
                  style={{
                    width: '200px',
                    height: '200px',
                    border: '1px solid black',
                    borderRadius: '50%', // Make it round
                  }}
                />
              </div>
            )}
            {/* Button to confirm and trigger upload */}
            {/* This button will now only appear if there is NO image being cropped */}
            {!src && (
              <button
                onClick={handleSubmit} // Use the existing handleSubmit
                className={`mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
                  isLoading || !hasChanges() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isLoading || !hasChanges()}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            )}

            {/* Button to cancel cropping */}
            <button
              onClick={() => {
                setSrc(null);
                setCrop(undefined);
                setCompletedCrop(undefined);
                setAvatarFile(null); // Clear the selected file
                // Revert avatarUrl to profile?.avatar_url or a default
                setAvatarUrl(profile?.avatar_url ?? null);
              }}
              className="mt-2 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tab Content Area */}
      <div className="mt-6">
        {/* Content will be rendered here based on activeTab */}
        {activeTab === 'overview' && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Overview Content Placeholder</h3>
            {/* Add sections like Brief Info, Next Meetings, Goals, Reviews here */}
            {message && (
              <div
                className={`p-4 mb-4 rounded ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
                <button onClick={() => setMessage(null)} className="ml-2 text-sm underline">
                  Dismiss
                </button>
              </div>
            )}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Brief info</h4>
              {/* Display Brief Info details from profile */}
              <p className="text-gray-700">Job title: {profile?.job_title || 'Not set'}</p>
              <p className="text-gray-700">
                Role: {profile?.role ? roleDisplayNames[profile.role] : 'N/A'}
              </p>
              {/* Add Level, Manager, Location if available in profile */}
              <p className="text-gray-700">Email: {user?.email}</p>
              <p className="text-gray-700">
                Start date:{' '}
                {profile?.employment_start_date
                  ? new Date(profile.employment_start_date).toDateString()
                  : 'Not set'}
              </p>
              <p className="text-gray-700">
                Date of Birth:{' '}
                {profile?.birthdate ? new Date(profile.birthdate).toDateString() : 'Not set'}
              </p>
              <p className="text-gray-700">Age: {calculateAge(profile?.birthdate)}</p>
              <p className="text-gray-700">
                Time at Company: {calculateTenure(profile?.employment_start_date)}
              </p>
              {/* Add Bio section later */}
            </div>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Next meetings</h4>
              {/* Placeholder for meetings list */}
              <p className="text-gray-700">No upcoming meetings.</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Goals</h4>
              {/* Placeholder for goals progress */}
              <p className="text-gray-700">Goals progress placeholder.</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Reviews</h4>
              {/* Placeholder for reviews list */}
              <p className="text-gray-700">No completed reviews.</p>
            </div>
          </div>
        )}
        {activeTab === 'info' && (
          <div className="flex">
            {/* Left Navigation for Info Sub-tabs */}
            <div className="w-1/4 pr-8">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveInfoTab('personal')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'personal'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Personal
                </button>
                <button
                  onClick={() => setActiveInfoTab('employment')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'employment'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Employment info
                </button>
                {/* Add other sub-tabs as needed */}
                <button
                  onClick={() => setActiveInfoTab('equity')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'equity'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Equity
                </button>
                <button
                  onClick={() => setActiveInfoTab('compensation')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'compensation'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Compensation
                </button>
                <button
                  onClick={() => setActiveInfoTab('teams')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'teams'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Teams
                </button>
                <button
                  onClick={() => setActiveInfoTab('attributes')}
                  className={`block w-full text-left py-2 px-4 rounded ${
                    activeInfoTab === 'attributes'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Custom attributes
                </button>
              </nav>
            </div>

            {/* Right Content Area for Info Sub-tabs */}
            <div className="w-3/4 bg-white shadow rounded-lg p-6">
              {activeInfoTab === 'personal' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold">Personal</h4>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    // Edit mode - Personal Info Form
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Supabase ID (Read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          User ID
                        </label>
                        <input
                          type="text"
                          value={profile?.id || 'N/A'}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                        />
                      </div>
                      {/* First Name */}
                      <div>
                        <label
                          htmlFor="firstName"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          First name *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {/* Last Name */}
                      <div>
                        <label
                          htmlFor="lastName"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Last name *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {/* Birthdate */}
                      <div>
                        <label
                          htmlFor="birthdate"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          id="birthdate"
                          value={birthdate}
                          onChange={e => setBirthdate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {/* Age (Read-only - Placeholder for derivation) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                        <p className="mt-1 text-gray-700">
                          {/* Calculate from birthdate */} Placeholder years
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Auto-generated based on birthday
                        </p>
                      </div>
                      {/* Preferred full name */}
                      <div>
                        <label
                          htmlFor="preferredName"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Preferred full name
                        </label>
                        <input
                          type="text"
                          id="preferredName"
                          value={preferredName}
                          onChange={e => setPreferredName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">Not set</p>
                        <p className="mt-1 text-xs text-gray-500">
                          This name will be displayed across the application instead of first name
                          and last name unless a legal name is required for, e.g., compliance
                          reasons
                        </p>
                      </div>
                      {/* Gender */}
                      <div>
                        <label
                          htmlFor="gender"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Gender
                        </label>
                        <input
                          type="text"
                          id="gender"
                          value={gender}
                          onChange={e => setGender(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          disabled={isLoading || isUploadingAvatar}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          onClick={() =>
                            console.log('[Save Changes button] Clicked in Personal Info.')
                          }
                          disabled={isLoading || !hasChanges() || isUploadingAvatar}
                          className={`px-4 py-2 rounded text-white ${
                            isLoading || !hasChanges() || isUploadingAvatar
                              ? 'bg-blue-300'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isLoading || isUploadingAvatar ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    // View mode - Display Personal Info
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">User ID</h3>
                        <p className="mt-1">{profile?.id}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">First Name</h3>
                        <p className="mt-1">{profile?.first_name || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Last Name</h3>
                        <p className="mt-1">{profile?.last_name || 'Not set'}</p>
                      </div>
                      {/* Display Birthdate */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Date of Birth</h3>
                        <p className="mt-1">
                          {profile?.birthdate
                            ? new Date(profile.birthdate).toDateString()
                            : 'Not set'}
                        </p>
                      </div>
                      {/* Display Age */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Age</h3>
                        <p className="mt-1">{calculateAge(profile?.birthdate)}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Preferred full name</h3>
                        <p className="mt-1">{profile?.preferred_name || 'Not set'}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          This name will be displayed across the application instead of first name
                          and last name unless a legal name is required for, e.g., compliance
                          reasons
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Gender</h3>
                        <p className="mt-1">{profile?.gender || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Role</h3>
                        <p className="mt-1">
                          {profile?.role ? roleDisplayNames[profile.role] : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Start date</h3>
                        <p className="mt-1">
                          {profile?.employment_start_date
                            ? new Date(profile.employment_start_date).toDateString()
                            : 'Not set'}
                        </p>
                      </div>
                      {/* Display Time at Company */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Time at Company</h3>
                        <p className="mt-1">{calculateTenure(profile?.employment_start_date)}</p>
                      </div>
                      {/* Display other personal details here */}
                    </div>
                  )}
                </div>
              )}
              {activeInfoTab === 'employment' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Employment Info Placeholder</h4>
                  {/* Add Employment Info fields here */}
                </div>
              )}
              {activeInfoTab === 'equity' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Equity Placeholder</h4>
                  {/* Add Equity fields here */}
                </div>
              )}
              {activeInfoTab === 'compensation' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Compensation Placeholder</h4>
                  {/* Add Compensation fields here */}
                </div>
              )}
              {activeInfoTab === 'teams' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Teams Placeholder</h4>
                  {/* Add Teams fields here */}
                </div>
              )}
              {activeInfoTab === 'attributes' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Custom Attributes Placeholder</h4>
                  {/* Add Custom Attributes fields here */}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'documents' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Documents Content Placeholder</h3>
            {/* Add documents list here */}
          </div>
        )}
        {activeTab === 'workflows' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Workflows Content Placeholder</h3>
            {/* Add workflows content here */}
          </div>
        )}
        {activeTab === 'role' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Role</h3>
              {/* Only show Edit button if user is admin or hr_admin */}
              {(user?.user_metadata?.role === 'administrator' ||
                user?.user_metadata?.role === 'hr_admin') &&
                !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)} // Reuse isEditing state for Role tab for now
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    Edit
                  </button>
                )}
            </div>
            {isEditing ? (
              // Edit mode - Role selection
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="roleSelect"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Select Role
                  </label>
                  <select
                    id="roleSelect"
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as Role)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="" disabled>
                      Select a role
                    </option>
                    {/* Map over roles excluding patient and family_contact */}
                    {Object.entries(roleDisplayNames)
                      .filter(([role]) => role !== 'patient' && role !== 'family_contact')
                      .map(([role, displayName]) => (
                        <option key={role} value={role}>
                          {displayName}
                        </option>
                      ))}
                  </select>
                </div>
                {/* Job Title */}
                <div>
                  <label
                    htmlFor="jobTitle"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Job Title
                  </label>
                  <input
                    type="text"
                    id="jobTitle"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {/* Committees */}
                <div>
                  <label
                    htmlFor="committees"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Committees (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="committees"
                    value={committees}
                    onChange={e => setCommittees(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedRole(profile?.role || ''); // Revert changes on cancel
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    disabled={isLoading || isUploadingAvatar}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit} // Use handleSubmit for role update as well
                    disabled={isLoading || !hasChanges() || isUploadingAvatar}
                    className={`px-4 py-2 rounded text-white ${
                      isLoading || !hasChanges() || isUploadingAvatar
                        ? 'bg-blue-300'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoading || isUploadingAvatar ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              // View mode - Display current role
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Job Title</h3>
                  <p className="mt-1">{profile?.job_title || 'Not set'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Committees</h3>
                  <p className="mt-1">{profile?.committees || 'Not set'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Current Role</h3>
                  <p className="mt-1">{profile?.role ? roleDisplayNames[profile.role] : 'N/A'}</p>
                </div>
                {/* Add other role-related details here later if needed */}
              </div>
            )}
          </div>
        )}
        {activeTab === 'change-log' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Change Log Content Placeholder</h3>
            {/* Add change log content here */}
          </div>
        )}
      </div>
    </div>
  );
}
