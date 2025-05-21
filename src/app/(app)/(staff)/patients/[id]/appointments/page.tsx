'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO, addMinutes, setHours, setMinutes, addDays } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Download,
  Edit,
  FileText,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';

// Define the schema for appointments
const appointmentFormSchema = z.object({
  appointmentDate: z.date({
    required_error: 'Please select a date',
  }),
  appointmentTime: z.string({
    required_error: 'Please select a time',
  }),
  durationMinutes: z.coerce.number().min(15).default(60),
  serviceType: z.string().optional(),
  practitionerName: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default('scheduled'),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

// Appointment interface
interface Appointment {
  id: string;
  appointment_datetime: string;
  duration_minutes: number;
  service_type: string | null;
  practitioner_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  google_calendar_event_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  created_by: string | null;
}

// Patient interface
interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
}

export default function PatientAppointmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const patientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Time slots for the appointment
  const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return {
      value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      label: format(setHours(setMinutes(new Date(), minute), hour), 'h:mm a'),
    };
  });

  // Service types
  const serviceTypes = [
    { value: 'initial_assessment', label: 'Initial Assessment' },
    { value: 'follow_up', label: 'Follow-up Visit' },
    { value: 'therapy', label: 'Therapy Session' },
    { value: 'counseling', label: 'Counseling' },
    { value: 'medication_management', label: 'Medication Management' },
    { value: 'other', label: 'Other' },
  ];

  // Status options
  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
    { value: 'rescheduled', label: 'Rescheduled' },
  ];

  // Duration options
  const durationOptions = [
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '45', label: '45 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
  ];

  // Form definition
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      appointmentDate: new Date(),
      appointmentTime: '09:00',
      durationMinutes: 60,
      status: 'scheduled',
    },
  });

  // Fetch patient and appointments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch patient details
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('id, first_name, last_name, email, phone_number')
          .eq('id', patientId)
          .single();

        if (patientError) throw patientError;
        setPatient(patientData);

        // Fetch appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', patientId)
          .order('appointment_datetime', { ascending: true });

        if (appointmentsError) throw appointmentsError;
        setAppointments(appointmentsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load patient data or appointments.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, supabase, toast]);

  // Handle form submission
  const onSubmit = async (values: AppointmentFormValues) => {
    try {
      // Combine date and time
      const [hours, minutes] = values.appointmentTime.split(':').map(Number);
      const appointmentDateTime = new Date(values.appointmentDate);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      if (isEditing && selectedAppointment) {
        // Update existing appointment
        const { error } = await supabase.rpc('update_appointment', {
          p_appointment_id: selectedAppointment.id,
          p_appointment_datetime: appointmentDateTime.toISOString(),
          p_duration_minutes: values.durationMinutes,
          p_service_type: values.serviceType,
          p_practitioner_name: values.practitionerName,
          p_location: values.location,
          p_notes: values.notes,
          p_status: values.status,
        });

        if (error) throw error;

        toast({
          title: 'Appointment Updated',
          description: 'The appointment has been updated successfully.',
        });
      } else {
        // Create new appointment
        const { data, error } = await supabase.rpc('create_appointment', {
          p_patient_id: patientId,
          p_appointment_datetime: appointmentDateTime.toISOString(),
          p_duration_minutes: values.durationMinutes,
          p_service_type: values.serviceType,
          p_practitioner_name: values.practitionerName,
          p_location: values.location,
          p_notes: values.notes,
          p_status: values.status,
        });

        if (error) throw error;

        toast({
          title: 'Appointment Scheduled',
          description: 'The appointment has been scheduled successfully.',
        });
      }

      // Reset and close
      setDialogOpen(false);
      setIsEditing(false);
      setSelectedAppointment(null);
      form.reset();

      // Refresh appointments
      const { data: refreshedData } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_datetime', { ascending: true });

      setAppointments(refreshedData || []);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save the appointment. Please try again.',
      });
    }
  };

  // Handle appointment editing
  const handleEditAppointment = (appointment: Appointment) => {
    // Convert the ISO date string to separate date and time
    const dateTime = parseISO(appointment.appointment_datetime);

    // Set form values
    form.setValue('appointmentDate', dateTime);
    form.setValue('appointmentTime', format(dateTime, 'HH:mm'));
    form.setValue('durationMinutes', appointment.duration_minutes);
    form.setValue('serviceType', appointment.service_type || undefined);
    form.setValue('practitionerName', appointment.practitioner_name || undefined);
    form.setValue('location', appointment.location || undefined);
    form.setValue('notes', appointment.notes || undefined);
    form.setValue('status', appointment.status);

    setSelectedAppointment(appointment);
    setIsEditing(true);
    setDialogOpen(true);
  };

  // Handle appointment deletion
  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const { error } = await supabase.rpc('delete_appointment', {
        p_appointment_id: selectedAppointment.id,
      });

      if (error) throw error;

      toast({
        title: 'Appointment Deleted',
        description: 'The appointment has been deleted successfully.',
      });

      // Close dialog and refresh list
      setDeleteDialogOpen(false);
      setSelectedAppointment(null);

      // Remove from state
      setAppointments(appointments.filter(a => a.id !== selectedAppointment.id));
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete the appointment. Please try again.',
      });
    }
  };

  // Handle appointment cancellation
  const handleCancelAppointment = async (appointment: Appointment) => {
    try {
      const { error } = await supabase.rpc('update_appointment', {
        p_appointment_id: appointment.id,
        p_status: 'cancelled',
      });

      if (error) throw error;

      toast({
        title: 'Appointment Cancelled',
        description: 'The appointment has been cancelled successfully.',
      });

      // Update in state
      setAppointments(
        appointments.map(a => (a.id === appointment.id ? { ...a, status: 'cancelled' } : a))
      );
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel the appointment. Please try again.',
      });
    }
  };

  // Download ICS file
  const downloadIcsFile = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_appointment_ics', {
        p_appointment_id: appointmentId,
      });

      if (error) throw error;

      // Create a Blob from the ICS content
      const blob = new Blob([data], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);

      // Create a link and click it to download
      const link = document.createElement('a');
      link.href = url;
      link.download = `appointment-${appointmentId}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Calendar File Generated',
        description: 'The calendar file has been downloaded.',
      });
    } catch (error) {
      console.error('Error generating ICS:', error);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Failed to generate calendar file. Please try again.',
      });
    }
  };

  // Format appointment time
  const formatAppointmentTime = (datetimeStr: string, durationMinutes: number) => {
    const datetime = parseISO(datetimeStr);
    const startTime = format(datetime, 'h:mm a');
    const endTime = format(addMinutes(datetime, durationMinutes), 'h:mm a');
    return `${startTime} - ${endTime}`;
  };

  // Get color for status badge
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800',
      no_show: 'bg-purple-100 text-purple-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Loading patient appointments...</h1>
      </div>
    );
  }

  // No patient found
  if (!patient) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Patient not found. Please check the patient ID.
        </div>
        <Button onClick={() => router.push('/patients')} className="mt-4" variant="outline">
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Appointments for {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-gray-500">
            {patient.email && <span className="mr-4">{patient.email}</span>}
            {patient.phone_number && <span>{patient.phone_number}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/patients/${patientId}`)}>Back to Patient</Button>
          <Link href="/scheduling">
            <Button variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Staff Schedule
            </Button>
          </Link>
          <Button
            onClick={() => {
              form.reset({
                appointmentDate: new Date(),
                appointmentTime: '09:00',
                durationMinutes: 60,
                status: 'scheduled',
              });
              setIsEditing(false);
              setSelectedAppointment(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Schedule Appointment
          </Button>
        </div>
      </div>

      {/* Appointments list */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-5 w-5" />
              Patient Appointments
            </div>
          </CardTitle>
          <CardDescription>Manage and schedule appointments for this patient</CardDescription>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No appointments scheduled for this patient.
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map(appointment => (
                <Card key={appointment.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {appointment.service_type
                            ? serviceTypes.find(s => s.value === appointment.service_type)?.label ||
                              appointment.service_type
                            : 'Appointment'}
                        </CardTitle>
                        <CardDescription>
                          {format(parseISO(appointment.appointment_datetime), 'EEEE, MMMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {appointment.status.charAt(0).toUpperCase() +
                            appointment.status.slice(1).replace('_', ' ')}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditAppointment(appointment)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadIcsFile(appointment.id)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download ICS
                            </DropdownMenuItem>
                            {appointment.status !== 'cancelled' && (
                              <DropdownMenuItem
                                onClick={() => handleCancelAppointment(appointment)}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-700">
                        <Clock className="mr-2 h-4 w-4" />
                        {formatAppointmentTime(
                          appointment.appointment_datetime,
                          appointment.duration_minutes
                        )}
                      </div>

                      {appointment.practitioner_name && (
                        <div className="flex items-center text-gray-700">
                          <User className="mr-2 h-4 w-4" />
                          {appointment.practitioner_name}
                        </div>
                      )}

                      {appointment.location && (
                        <div className="flex items-center text-gray-700">
                          <MapPin className="mr-2 h-4 w-4" />
                          {appointment.location}
                        </div>
                      )}

                      {appointment.notes && (
                        <div className="flex items-start text-gray-700">
                          <FileText className="mr-2 h-4 w-4 mt-1" />
                          <div className="whitespace-pre-wrap">{appointment.notes}</div>
                        </div>
                      )}

                      {appointment.google_calendar_event_id && (
                        <div className="flex items-center text-green-600 mt-2">
                          <Check className="mr-2 h-4 w-4" />
                          Synced with Google Calendar
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Appointment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Appointment' : 'Schedule New Appointment'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update appointment details below.'
                : `Schedule a new appointment for ${patient.first_name} ${patient.last_name}.`}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="pl-3 text-left font-normal">
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Time */}
                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timeSlots.map(slot => (
                            <SelectItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duration */}
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <Select
                        onValueChange={value => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {durationOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Type */}
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Practitioner */}
                <FormField
                  control={form.control}
                  name="practitionerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <FormControl>
                        <Input placeholder="Provider name" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Appointment location"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes or instructions"
                        className="resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update Appointment' : 'Schedule Appointment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="py-4">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Appointment details:</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Date: {format(parseISO(selectedAppointment.appointment_datetime), 'PPP')}
                      </p>
                      <p>Time: {format(parseISO(selectedAppointment.appointment_datetime), 'p')}</p>
                      {selectedAppointment.service_type && (
                        <p>Type: {selectedAppointment.service_type}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAppointment}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
