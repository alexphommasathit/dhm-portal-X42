'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, isSameDay, addDays, setHours, setMinutes } from 'date-fns';
import { createClientComponentSupabase as createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  MapPin,
  FileText,
  Users,
  Phone,
  MoreVertical,
  Edit,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Protected from '@/components/Protected';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// Define appointment interface
interface Appointment {
  id: string;
  patient_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  service_type: string | null;
  practitioner_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  patient: {
    first_name: string;
    last_name: string;
    phone_number: string | null;
    email: string | null;
  };
}

// Group appointments by practitioner
type PractitionerAppointments = {
  practitioner: string;
  appointments: Appointment[];
};

// Database appointment interface may have nullable duration_minutes
interface DbAppointment {
  id: string;
  patient_id: string;
  appointment_datetime: string;
  duration_minutes: number | null;
  service_type: string | null;
  practitioner_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  patient: {
    first_name: string;
    last_name: string;
    phone_number: string | null;
    email: string | null;
  };
}

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

export default function StaffSchedulingPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [practitioners, setPractitioners] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [filterPractitioner, setFilterPractitioner] = useState<string>('all');

  // Add new state variables for editing
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // Calculate date range for week view
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));

  // Format appointment time in a readable format
  const formatAppointmentTime = (datetime: string, durationMinutes: number) => {
    const date = parseISO(datetime);
    const start = format(date, 'h:mm a');
    const end = format(new Date(date.getTime() + durationMinutes * 60000), 'h:mm a');
    return `${start} - ${end}`;
  };

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'rescheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch appointments and extract unique practitioners
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);

        // Create date range based on view
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        let endDate = new Date(selectedDate);
        if (view === 'week') {
          endDate = addDays(selectedDate, 6);
        }
        endDate.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from('appointments')
          .select(
            `
            *,
            patient:patient_id (
              first_name,
              last_name,
              phone_number,
              email
            )
          `
          )
          .gte('appointment_datetime', startDate.toISOString())
          .lte('appointment_datetime', endDate.toISOString())
          .order('appointment_datetime', { ascending: true });

        if (error) {
          throw error;
        }

        // Ensure duration_minutes is never null
        const typedData = (data || []).map((appointment: DbAppointment) => ({
          ...appointment,
          duration_minutes: appointment.duration_minutes || 30, // Default to 30 if null
        })) as Appointment[];

        setAppointments(typedData);

        // Extract unique practitioners
        const uniquePractitioners = Array.from(
          new Set(data?.map(app => app.practitioner_name).filter(Boolean))
        ) as string[];

        setPractitioners(uniquePractitioners);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load appointments. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [selectedDate, view, supabase, toast]);

  // Group appointments by practitioner
  const getGroupedAppointments = (): PractitionerAppointments[] => {
    // Filter appointments if needed
    let filteredAppointments = appointments;

    if (filterPractitioner !== 'all') {
      filteredAppointments = appointments.filter(
        app => app.practitioner_name === filterPractitioner
      );
    }

    // Group by practitioner
    const grouped: Record<string, Appointment[]> = {};

    filteredAppointments.forEach(appointment => {
      const practitioner = appointment.practitioner_name || 'Unassigned';
      if (!grouped[practitioner]) {
        grouped[practitioner] = [];
      }
      grouped[practitioner].push(appointment);
    });

    // Convert to array format
    return Object.entries(grouped).map(([practitioner, appointments]) => ({
      practitioner,
      appointments,
    }));
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (date: Date, practitioner?: string) => {
    return appointments.filter(app => {
      const appointmentDate = parseISO(app.appointment_datetime);
      const samePractitioner = !practitioner || app.practitioner_name === practitioner;
      return isSameDay(appointmentDate, date) && samePractitioner;
    });
  };

  // Add handleEditAppointment function
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

  // Add onSubmit function for the form
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

        // Update in local state
        setAppointments(
          appointments.map(a =>
            a.id === selectedAppointment.id
              ? {
                  ...a,
                  appointment_datetime: appointmentDateTime.toISOString(),
                  duration_minutes: values.durationMinutes,
                  service_type: values.serviceType,
                  practitioner_name: values.practitionerName,
                  location: values.location,
                  notes: values.notes,
                  status: values.status,
                }
              : a
          )
        );
      }

      // Reset and close
      setDialogOpen(false);
      setIsEditing(false);
      setSelectedAppointment(null);
      form.reset();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save the appointment. Please try again.',
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

  return (
    <Protected resource="patients" permission="read">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Staff Scheduling</h1>
            <p className="text-gray-600">View and manage appointments by practitioner</p>
          </div>
          <div className="flex gap-2">
            <Select value={filterPractitioner} onValueChange={setFilterPractitioner}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by practitioner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Practitioners</SelectItem>
                {practitioners.map(practitioner => (
                  <SelectItem key={practitioner} value={practitioner}>
                    {practitioner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/patients">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Patient List
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    Appointment Calendar
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView('day')}
                      className={view === 'day' ? 'bg-blue-50' : ''}
                    >
                      Day
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView('week')}
                      className={view === 'week' ? 'bg-blue-50' : ''}
                    >
                      Week
                    </Button>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedDate(d => addDays(d, -1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedDate(new Date())}>
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedDate(d => addDays(d, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardTitle>
                <CardDescription>
                  {view === 'day'
                    ? format(selectedDate, 'EEEE, MMMM d, yyyy')
                    : `Week of ${format(selectedDate, 'MMMM d, yyyy')}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex border rounded-md overflow-hidden">
                  <div className="w-1/4 border-r p-4">
                    <div className="text-center mb-4">
                      <h3 className="font-medium">{format(selectedDate, 'MMMM yyyy')}</h3>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="text-xs font-medium text-gray-500">
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: 35 }, (_, i) => {
                        const date = new Date(selectedDate);
                        date.setDate(1); // Start of month
                        date.setDate(i - date.getDay() + 1); // Adjust to start on Sunday

                        const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                        const isSelected = isSameDay(date, selectedDate);

                        return (
                          <div
                            key={i}
                            className={`text-xs rounded-full w-7 h-7 flex items-center justify-center cursor-pointer
                              ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                              ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}
                            `}
                            onClick={() => setSelectedDate(new Date(date))}
                          >
                            {date.getDate()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="w-3/4 p-4">
                    {view === 'day' ? (
                      // Day view
                      <div className="space-y-6">
                        {getGroupedAppointments().map(({ practitioner, appointments }) => (
                          <div key={practitioner} className="space-y-2">
                            <h3 className="font-medium text-lg flex items-center">
                              <User className="mr-2 h-4 w-4" />
                              {practitioner}
                            </h3>
                            <div className="space-y-2">
                              {appointments.length === 0 ? (
                                <p className="text-gray-500 text-sm italic">
                                  No appointments scheduled
                                </p>
                              ) : (
                                appointments.map(appointment => (
                                  <Card key={appointment.id} className="overflow-hidden">
                                    <div className="p-3 border-l-4 border-blue-500 flex justify-between">
                                      <div>
                                        <div className="font-medium">
                                          {appointment.patient.first_name}{' '}
                                          {appointment.patient.last_name}
                                        </div>
                                        <div className="text-sm flex items-center text-gray-600">
                                          <Clock className="mr-1 h-3 w-3" />
                                          {formatAppointmentTime(
                                            appointment.appointment_datetime,
                                            appointment.duration_minutes
                                          )}
                                        </div>
                                        {appointment.service_type && (
                                          <div className="text-sm text-gray-600">
                                            {appointment.service_type}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-start space-x-2">
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
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => handleEditAppointment(appointment)}
                                            >
                                              <Edit className="mr-2 h-4 w-4" />
                                              Edit
                                            </DropdownMenuItem>
                                            <Link
                                              href={`/patients/${appointment.patient_id}/appointments`}
                                            >
                                              <DropdownMenuItem>
                                                <User className="mr-2 h-4 w-4" />
                                                View Patient
                                              </DropdownMenuItem>
                                            </Link>
                                            {appointment.status !== 'cancelled' && (
                                              <DropdownMenuItem
                                                onClick={() => handleCancelAppointment(appointment)}
                                              >
                                                <X className="mr-2 h-4 w-4" />
                                                Cancel
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </Card>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Week view
                      <div className="grid grid-cols-7 gap-2">
                        {weekDates.map(date => (
                          <div key={date.toISOString()} className="border rounded-md p-2">
                            <div className="text-center font-medium pb-1 border-b mb-2">
                              {format(date, 'EEE, MMM d')}
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                              {filterPractitioner === 'all' ? (
                                getAppointmentsForDay(date).length === 0 ? (
                                  <p className="text-xs text-gray-500 text-center">
                                    No appointments
                                  </p>
                                ) : (
                                  getAppointmentsForDay(date).map(appointment => (
                                    <Card key={appointment.id} className="overflow-hidden">
                                      <div className="p-2 border-l-4 border-blue-500">
                                        <div className="font-medium text-xs">
                                          {appointment.patient.first_name}{' '}
                                          {appointment.patient.last_name}
                                        </div>
                                        <div className="text-xs flex items-center text-gray-600">
                                          <Clock className="mr-1 h-3 w-3" />
                                          {format(
                                            parseISO(appointment.appointment_datetime),
                                            'h:mm a'
                                          )}
                                        </div>
                                        {appointment.practitioner_name && (
                                          <div className="text-xs flex items-center text-gray-600">
                                            <User className="mr-1 h-3 w-3" />
                                            {appointment.practitioner_name}
                                          </div>
                                        )}
                                      </div>
                                    </Card>
                                  ))
                                )
                              ) : getAppointmentsForDay(date, filterPractitioner).length === 0 ? (
                                <p className="text-xs text-gray-500 text-center">No appointments</p>
                              ) : (
                                getAppointmentsForDay(date, filterPractitioner).map(appointment => (
                                  <Card key={appointment.id} className="overflow-hidden">
                                    <div className="p-2 border-l-4 border-blue-500">
                                      <div className="font-medium text-xs">
                                        {appointment.patient.first_name}{' '}
                                        {appointment.patient.last_name}
                                      </div>
                                      <div className="text-xs flex items-center text-gray-600">
                                        <Clock className="mr-1 h-3 w-3" />
                                        {format(
                                          parseISO(appointment.appointment_datetime),
                                          'h:mm a'
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Appointments by Practitioner
                </CardTitle>
                <CardDescription>
                  {view === 'day'
                    ? format(selectedDate, 'EEEE, MMMM d, yyyy')
                    : `Week of ${format(selectedDate, 'MMMM d, yyyy')}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-10">Loading appointments...</div>
                ) : (
                  <div className="space-y-8">
                    {getGroupedAppointments().length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        No appointments scheduled for this period.
                      </div>
                    ) : (
                      getGroupedAppointments().map(({ practitioner, appointments }) => (
                        <div key={practitioner} className="space-y-4">
                          <h3 className="font-medium text-lg flex items-center border-b pb-2">
                            <User className="mr-2 h-5 w-5" />
                            {practitioner} ({appointments.length} appointment
                            {appointments.length !== 1 ? 's' : ''})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {appointments.map(appointment => (
                              <Card key={appointment.id} className="overflow-hidden">
                                <CardHeader className="p-4 pb-2">
                                  <div className="flex justify-between">
                                    <div>
                                      <CardTitle className="text-base">
                                        {appointment.patient.first_name}{' '}
                                        {appointment.patient.last_name}
                                      </CardTitle>
                                      <CardDescription>
                                        {format(
                                          parseISO(appointment.appointment_datetime),
                                          'EEEE, MMMM d, yyyy'
                                        )}
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
                                      <Link
                                        href={`/patients/${appointment.patient_id}/appointments`}
                                      >
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <User className="h-4 w-4" />
                                        </Button>
                                      </Link>
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

                                    {appointment.service_type && (
                                      <div className="flex items-center text-gray-700">
                                        <FileText className="mr-2 h-4 w-4" />
                                        {appointment.service_type}
                                      </div>
                                    )}

                                    {appointment.location && (
                                      <div className="flex items-center text-gray-700">
                                        <MapPin className="mr-2 h-4 w-4" />
                                        {appointment.location}
                                      </div>
                                    )}

                                    {appointment.patient.phone_number && (
                                      <div className="flex items-center text-gray-700">
                                        <Phone className="mr-2 h-4 w-4" />
                                        {appointment.patient.phone_number}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Appointment Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Appointment' : 'Schedule New Appointment'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update appointment details below.' : 'Schedule a new appointment.'}
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
    </Protected>
  );
}
