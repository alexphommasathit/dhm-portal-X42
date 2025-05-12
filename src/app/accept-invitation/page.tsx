'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, AlertCircle, ChevronRight, UserPlus } from 'lucide-react';

// Define form schema for account creation
const userFormSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(100, { message: 'Password must be less than 100 characters' }),
    confirmPassword: z.string().min(8, { message: 'Please confirm your password' }),
    firstName: z.string().min(2, { message: 'First name is required' }),
    lastName: z.string().min(2, { message: 'Last name is required' }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type UserFormValues = z.infer<typeof userFormSchema>;

interface InvitationDetails {
  id: string;
  patientId: string;
  email: string;
  role: string;
  patientName: string;
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const supabase = createClientComponentSupabase();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
  });

  // Validate token and get invitation details
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Invalid Invitation',
          description: 'No invitation token was provided.',
        });
        setValidating(false);
        return;
      }

      try {
        // Check if token is valid and get invitation details
        const { data, error } = await supabase.rpc('get_invitation_details', {
          p_token: token,
        });

        if (error) throw error;

        if (!data) {
          toast({
            variant: 'destructive',
            title: 'Invalid Invitation',
            description: 'The invitation token is invalid or has expired.',
          });
          setValidToken(false);
        } else {
          setValidToken(true);
          setInvitation({
            id: data.id,
            patientId: data.patient_id,
            email: data.email,
            role: data.role,
            patientName: `${data.patient_first_name} ${data.patient_last_name}`,
            expiresAt: data.expires_at,
          });

          // Set email in the form
          form.setValue('email', data.email);

          // Check if user is already logged in
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            setHasAccount(true);
          }
        }
      } catch (error) {
        console.error('Error validating token:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to validate invitation. Please try again.',
        });
        setValidToken(false);
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };

    validateToken();
  }, [token, toast, supabase, form]);

  // Handle form submission for new account
  const onSubmit = async (data: UserFormValues) => {
    if (!invitation) return;

    setSubmitting(true);

    try {
      // Create new user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      if (authError) throw authError;

      // Accept the invitation with the token
      const { error: acceptError } = await supabase.rpc('accept_patient_portal_invitation', {
        p_token: token,
      });

      if (acceptError) throw acceptError;

      toast({
        title: 'Success',
        description: 'Your account has been created and linked to the patient portal.',
      });

      setSuccess(true);

      // Redirect to the patient portal after a delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create account.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle accepting invitation for existing account
  const acceptInvitation = async () => {
    if (!invitation) return;

    setSubmitting(true);

    try {
      // Accept the invitation with the token
      const { error } = await supabase.rpc('accept_patient_portal_invitation', {
        p_token: token,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Your account has been linked to the patient portal.',
      });

      setSuccess(true);

      // Redirect to the patient portal after a delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state
  if (loading || validating) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Validating Invitation</CardTitle>
            <CardDescription>Please wait while we validate your invitation...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error for invalid token
  if (!validToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="mt-4">Invalid Invitation</CardTitle>
            <CardDescription>
              The invitation link you followed is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/')}>Return to Home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <CardTitle className="mt-4">Invitation Accepted</CardTitle>
            <CardDescription>
              Your account has been successfully linked to the patient portal. Redirecting to
              dashboard...
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show form for new account creation or button for existing account
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center">Accept Portal Invitation</CardTitle>
          {invitation && (
            <CardDescription className="text-center">
              You've been invited to access the patient portal for{' '}
              <span className="font-medium">{invitation.patientName}</span> as a{' '}
              <span className="font-medium">{invitation.role.replace('_', ' ')}</span>.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {hasAccount ? (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <UserPlus className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Account Detected</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        You're already logged in. Click the button below to link your account to
                        this patient.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <Button onClick={acceptInvitation} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Accept Invitation'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" readOnly disabled />
                        </FormControl>
                        <FormDescription>
                          This email address was specified in the invitation.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="First name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Create a password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account & Accept'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
