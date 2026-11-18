// Shared steps for the release suites. Selectors come from the app's markup.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export { expect };

export async function newPage(runtime, role, options) {
  const context = await runtime.context(role, options);
  return context.newPage();
}

/** Fills the new-booking form and returns the new booking's id. */
export async function createBooking(page, booking) {
  await page.goto("/bookings/new");
  await expect(
    page.getByRole("heading", { name: "New booking" }),
  ).toBeVisible();
  await page.getByLabel("Customer name").fill(booking.customer);
  await page.getByLabel("Customer email").fill(booking.email ?? "");
  await page.getByLabel("Consignee").fill(booking.consignee ?? "");
  await page.getByLabel("Carrier").fill(booking.carrier ?? "");
  await page.getByLabel("Vessel", { exact: true }).fill(booking.vessel ?? "");
  await page.getByLabel("Voyage", { exact: true }).fill(booking.voyage ?? "");
  await page.getByLabel("Cargo notes").fill(booking.notes ?? "");
  const legs = booking.legs ?? [];
  for (let index = 0; index < legs.length; index++) {
    if (index > 0) await page.getByRole("button", { name: "Add leg" }).click();
    const row = page.getByTestId("leg-fields").nth(index);
    await row.getByLabel("From port").fill(legs[index].from);
    await row.getByLabel("To port").fill(legs[index].to);
    await row
      .getByLabel("Vessel / voyage")
      .fill(legs[index].vesselVoyage ?? "");
    await row.getByLabel("ETD").fill(legs[index].etd ?? "");
    await row.getByLabel("ETA").fill(legs[index].eta ?? "");
  }
  await Promise.all([
    page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/),
    page.getByRole("button", { name: "Create booking" }).click(),
  ]);
  await expect(page.getByTestId("booking-status")).toBeVisible();
  return page.url().split("/").pop();
}

/** Adds a vehicle through the dialog; resolves when the dialog closes. */
export async function addVehicle(page, vehicle) {
  await page.getByRole("button", { name: "Add vehicle" }).click();
  const dialog = page.getByRole("dialog");
  await fillVehicle(dialog, vehicle);
  await dialog.getByRole("button", { name: "Save vehicle" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByTestId("vehicle-row").filter({ hasText: vehicle.vin }),
  ).toBeVisible();
}

export async function fillVehicle(dialog, vehicle) {
  await dialog.getByLabel("VIN").fill(vehicle.vin);
  if (vehicle.make !== undefined)
    await dialog.getByLabel("Make").fill(vehicle.make);
  if (vehicle.model !== undefined)
    await dialog.getByLabel("Model").fill(vehicle.model);
  if (vehicle.year !== undefined)
    await dialog.getByLabel("Year").fill(String(vehicle.year));
  if (vehicle.length !== undefined)
    await dialog.getByLabel("Length (cm)").fill(String(vehicle.length));
  if (vehicle.width !== undefined)
    await dialog.getByLabel("Width (cm)").fill(String(vehicle.width));
  if (vehicle.height !== undefined)
    await dialog.getByLabel("Height (cm)").fill(String(vehicle.height));
  if (vehicle.weight !== undefined)
    await dialog.getByLabel("Weight (kg)").fill(String(vehicle.weight));
}

/** Uploads a file to the booking open on the page. */
export async function uploadAttachment(page, file) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/attachments") &&
        response.request().method() === "POST",
    ),
    page.getByTestId("attachment-input").setInputFiles(file),
  ]);
  await expect(
    page.getByTestId("attachment-row").filter({ hasText: file.name }),
  ).toBeVisible();
}

/** Runs `action` and returns the server-function request it sent. */
export async function captureServerCall(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.url().includes("/_serverFn/") && request.method() === "POST",
    ),
    action(),
  ]);
  return {
    path: new URL(request.url()).pathname + new URL(request.url()).search,
    headers: Object.fromEntries(
      Object.entries(await request.allHeaders()).filter(([name]) =>
        ["content-type", "accept", "x-tsr-serverfn", "x-tsr-redirect"].includes(
          name.toLowerCase(),
        ),
      ),
    ),
    body: request.postData(),
  };
}

export async function replay(runtime, call, role) {
  return runtime.fetch(call.path, {
    role,
    method: "POST",
    headers: call.headers,
    body: call.body,
  });
}

export const pdf = (name, text = "Dock receipt") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`),
});
