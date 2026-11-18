import type { getBooking } from "@/serverFunctions/bookings";

export type BookingData = NonNullable<Awaited<ReturnType<typeof getBooking>>>;
