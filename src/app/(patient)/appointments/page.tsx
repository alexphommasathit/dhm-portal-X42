'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameDay, addDays } from 'date-fns';
import { createClientComponentSupabase } from '@/lib/supabase/client';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Download,
  FileText,
  MapPin,
  User,
} from 'lucide-react';

interface Appointment {
  id: string;
  appointment_datetime: string;
  duration_minutes: number;
  service_type: string | null;
  practitioner_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
}

export default function PatientAppointmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClientComponentSupabase();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointmentsForDay, setAppointmentsForDay] = useState<Appointment[]>([]);
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar');

  // Format dates for calendar highlighting
  const appointmentDates = appointments.map(appointment =>
    parseISO(appointment.appointment_datetime)
  );

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get user's patient ID
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Get patient ID from profile
        const { data: profileData, error: profileError } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (profileError) throw profileError;

        if (!profileData) {
          setError('No patient profile found. Please contact support.');
          setLoading(false);
          return;
        }

        // Get upcoming appointments
        const { data, error: appointmentsError } = await supabase.rpc(
          'get_patient_upcoming_appointments',
          {
            p_patient_id: profileData.id,
            p_days_ahead: 60,
          }
        );

        if (appointmentsError) throw appointmentsError;

        setAppointments(data || []);

        // Filter appointments for selected day
        if (selectedDate) {
          filterAppointmentsForDay(selectedDate, data || []);
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setError('Failed to load appointments. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [router, supabase, selectedDate]);

  // Filter appointments for selected day
  const filterAppointmentsForDay = (date: Date, appointmentsList: Appointment[] = appointments) => {
    const filtered = appointmentsList.filter(appointment =>
      isSameDay(parseISO(appointment.appointment_datetime), date)
    );
    setAppointmentsForDay(filtered);
  };

  // Handle date selection in calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      filterAppointmentsForDay(date);
    }
  };

  // Download ICS file for appointment
  const downloadIcs = async (appointmentId: string) => {
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
        title: 'Calendar File Downloaded',
        description: 'You can now import this into your calendar application.',
      });
    } catch (error) {
      console.error('Error downloading ICS:', error);
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
    const endTime = format(
      addDays(datetime, 0).setMinutes(datetime.getMinutes() + durationMinutes),
      'h:mm a'
    );
    return `${startTime} - ${endTime}`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusStyles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800',
      no_show: 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs ${statusStyles[status] || 'bg-gray-100'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">My Appointments</h1>
        <div className="text-center py-10">Loading appointments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">My Appointments</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Appointments</h1>
        <div className="flex gap-2">
          <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="View Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar">Calendar View</SelectItem>
              <SelectItem value="list">List View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewType === 'calendar' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5" />
                Calendar
              </CardTitle>
              <CardDescription>Select a date to view appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="rounded-md border"
                disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                modifiersStyles={{
                  selected: { backgroundColor: 'hsl(var(--primary))' },
                }}
                modifiers={{
                  booked: appointmentDates,
                }}
                modifiersClassNames={{
                  booked: 'border-2 border-primary text-primary font-bold',
                }}
              />
            </CardContent>
          </Card>

          {/* Appointments for selected day */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'No date selected'}
              </CardTitle>
              <CardDescription>
                {appointmentsForDay.length === 0
                  ? 'No appointments scheduled for this day'
                  : `${appointmentsForDay.length} appointment${
                      appointmentsForDay.length > 1 ? 's' : ''
                    } scheduled`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appointmentsForDay.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No appointments found for this date
                </div>
              ) : (
                <div className="space-y-4">
                  {appointmentsForDay.map(appointment => (
                    <Card key={appointment.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between">
                          <CardTitle className="text-lg">
                            {appointment.service_type || 'Appointment'}
                          </CardTitle>
                          <StatusBadge status={appointment.status} />
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
                            <div className="flex items-center text-gray-700">
                              <FileText className="mr-2 h-4 w-4" />
                              {appointment.notes}
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="bg-gray-50 px-4 py-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadIcs(appointment.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Add to Calendar
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>
              {appointments.length === 0
                ? 'No upcoming appointments'
                : `${appointments.length} upcoming appointment${
                    appointments.length > 1 ? 's' : ''
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No upcoming appointments found</div>
            ) : (
              <div className="space-y-4">
                {appointments.map(appointment => (
                  <Card key={appointment.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {appointment.service_type || 'Appointment'}
                          </CardTitle>
                          <CardDescription>
                            {format(
                              parseISO(appointment.appointment_datetime),
                              'EEEE, MMMM d, yyyy'
                            )}
                          </CardDescription>
                        </div>
                        <StatusBadge status={appointment.status} />
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
                          <div className="flex items-center text-gray-700">
                            <FileText className="mr-2 h-4 w-4" />
                            {appointment.notes}
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 px-4 py-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadIcs(appointment.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Add to Calendar
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
