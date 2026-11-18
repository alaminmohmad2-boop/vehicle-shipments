import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import { createBookingInput } from "@/lib/shipping";
import * as bookings from "@/server/bookings";
import * as billing from "@/server/billing";
import * as tracking from "@/server/tracking";

// Every server function runs behind ensureUserMiddleware: `context.user` is
// the member the Gateway signed in, and every query checks they may open the booking.
const bookingId = z.object({ id: z.string().uuid() });

export const searchBookings = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.searchInput.parse(data))
  .handler(({ data, context }) => bookings.searchBookings(context.user, data));

export const createBooking = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => createBookingInput.parse(data))
  .handler(({ data, context }) => bookings.createBooking(context.user, data));

export const getBooking = createServerFn({ method: "GET" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookingId.parse(data))
  .handler(async ({ data, context }) => {
    const found = await bookings.getBooking(context.user, data.id);
    if (!found) return null;
    const { trackingToken, ...rest } = found;
    // The link is on the host this request came to: the app's own address.
    const trackingUrl = trackingToken
      ? new URL(`/t/${trackingToken}`, getRequest().url).href
      : null;
    return {
      ...rest,
      trackingUrl,
      billing: await billing.getBilling(context.user, data.id),
      isAdmin: isAdmin(context.user),
    };
  });

export const updateBooking = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.updateBookingInput.parse(data))
  .handler(({ data, context }) => bookings.updateBooking(context.user, data));

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookingId.parse(data))
  .handler(({ data, context }) =>
    bookings.deleteBooking(context.user, data.id),
  );

export const saveLeg = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.saveLegInput.parse(data))
  .handler(({ data, context }) => bookings.saveLeg(context.user, data));

export const removeLeg = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.legRef.parse(data))
  .handler(({ data, context }) => bookings.removeLeg(context.user, data));

export const moveLeg = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.moveLegInput.parse(data))
  .handler(({ data, context }) => bookings.moveLeg(context.user, data));

export const saveVehicle = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.saveVehicleInput.parse(data))
  .handler(({ data, context }) => bookings.saveVehicle(context.user, data));

export const removeVehicle = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.vehicleRef.parse(data))
  .handler(({ data, context }) => bookings.removeVehicle(context.user, data));

export const recordStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookings.recordStatusInput.parse(data))
  .handler(({ data, context }) => bookings.recordStatus(context.user, data));

export const reopenBooking = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookingId.parse(data))
  .handler(({ data, context }) =>
    bookings.reopenBooking(context.user, data.id),
  );

export const renewTrackingLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookingId.parse(data))
  .handler(({ data, context }) =>
    tracking.renewTrackingLink(context.user, data.id),
  );

export const revokeTrackingLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => bookingId.parse(data))
  .handler(({ data, context }) =>
    tracking.revokeTrackingLink(context.user, data.id),
  );
