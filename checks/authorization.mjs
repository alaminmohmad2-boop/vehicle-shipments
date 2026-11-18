// Authorization: the Gateway's perimeter, per-member ownership, admin-only tariffs,
// what the public tracking page exposes, and no sign-in of the app's own.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import {
  addVehicle,
  captureServerCall,
  createBooking,
  expect,
  newPage,
  pdf,
  replay,
  uploadAttachment,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/tariffs", "/bookings/new"]);

  // No sign-in, sign-up or password page of the app's own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
    "/logout",
    "/account",
    "/password",
  ]) {
    const anonymous = await runtime.fetch(path);
    expect([401, 403, 302, 303, 307]).toContain(anonymous.status);
    const member = await runtime.fetch(path, { role: "member" });
    expect(member.status).toBe(404);
    expect(await member.text()).not.toMatch(/type="password"/i);
  }

  const owner = await newPage(runtime, "owner");
  const member = await newPage(runtime, "member");

  // The owner's private booking.
  const ownerBooking = await createBooking(owner, {
    customer: "Fjord Auto AS",
    email: "logistics@fjordauto.example",
    carrier: "Nordic RoRo Line",
    vessel: "Polar Bridge",
    voyage: "PB-118",
    notes: "Owner-only cargo note",
    legs: [
      { from: "Drammen", to: "Emden", etd: "2026-12-09", eta: "2026-12-11" },
    ],
  });
  await addVehicle(owner, {
    vin: "YV1XZ12A1N1000001",
    make: "Volvo",
    model: "XC40",
    year: 2022,
  });
  await uploadAttachment(
    owner,
    pdf("customs-entry.pdf", "Owner customs entry"),
  );
  const ownerFile = await owner
    .getByTestId("attachment-row")
    .getByRole("link", { name: "Download" })
    .getAttribute("href");

  // A change the owner made, captured so another member can try the same request.
  await owner.getByRole("button", { name: "Edit details" }).click();
  await owner
    .getByRole("dialog")
    .getByLabel("Vessel", { exact: true })
    .fill("Polar Bridge II");
  const edit = await captureServerCall(owner, () =>
    owner
      .getByRole("dialog")
      .getByRole("button", { name: "Save details" })
      .click(),
  );
  await expect(owner.getByTestId("booking-details")).toContainText(
    "Polar Bridge II",
  );
  await owner.getByRole("button", { name: "Edit details" }).click();
  await owner
    .getByRole("dialog")
    .getByLabel("Vessel", { exact: true })
    .fill("Polar Bridge III");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Save details" })
    .click();
  await expect(owner.getByTestId("booking-details")).toContainText(
    "Polar Bridge III",
  );

  // A member can't read the owner's booking, its documents or files.
  await member.goto(`/bookings/${ownerBooking}`);
  await expect(member.getByText("Booking not found")).toBeVisible();
  await expect(member.getByText("Fjord Auto AS")).toHaveCount(0);
  await member.goto(`/bookings/${ownerBooking}/bill-of-lading`);
  await expect(member.getByText("Booking not found")).toBeVisible();
  await expect(member.getByText("YV1XZ12A1N1000001")).toHaveCount(0);
  await member.goto("/");
  await expect(member.getByText("Fjord Auto AS")).toHaveCount(0);
  await member.getByLabel("Search").fill("YV1XZ12A1N");
  await member.getByRole("button", { name: "Search" }).click();
  await expect(member.getByTestId("booking-row")).toHaveCount(0);
  expect((await runtime.fetch(ownerFile, { role: "member" })).status).toBe(404);
  expect(
    (await runtime.fetch(ownerFile, { role: "member", method: "DELETE" }))
      .status,
  ).toBe(404);
  const intruding = new FormData();
  intruding.append(
    "file",
    new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    "intrude.pdf",
  );
  expect(
    (
      await runtime.fetch(`/api/bookings/${ownerBooking}/attachments`, {
        role: "member",
        method: "POST",
        body: intruding,
      })
    ).status,
  ).toBe(404);
  expect((await runtime.fetch(ownerFile)).status).toBeGreaterThanOrEqual(401);
  expect(
    (await runtime.fetch(ownerFile, { role: "outsider" })).status,
  ).toBeGreaterThanOrEqual(401);

  // ...nor change it by replaying the owner's request.
  const replayed = await replay(runtime, edit, "member");
  expect(replayed.status).not.toBe(401);
  const db = await runtime.database();
  const row = await db
    .prepare("SELECT vessel FROM bookings WHERE id = ?")
    .bind(ownerBooking)
    .first();
  expect(row.vessel).toBe("Polar Bridge III");
  expect([401, 403]).toContain(
    (await replay(runtime, edit, "outsider")).status,
  );
  expect([401, 403]).toContain((await replay(runtime, edit, undefined)).status);
  // The owner replaying their own request does change it, so the refusal above was the rule, not a bad replay.
  await replay(runtime, edit, "owner");
  expect(
    (
      await db
        .prepare("SELECT vessel FROM bookings WHERE id = ?")
        .bind(ownerBooking)
        .first()
    ).vessel,
  ).toBe("Polar Bridge II");

  // The owner's invoice is private too.
  await owner.goto(`/bookings/${ownerBooking}`);
  await owner.getByRole("button", { name: "Add charge" }).click();
  let dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Ocean freight");
  await dialog.getByLabel("Quantity").fill("1");
  await dialog.getByLabel("Unit price").fill("700");
  await dialog.getByLabel("Currency").fill("EUR");
  await dialog.getByRole("button", { name: "Save charge" }).click();
  await owner.getByRole("button", { name: "Issue invoice" }).click();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Issue" })
    .click();
  const invoiceHref = await owner
    .getByTestId("invoice-row")
    .first()
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  await member.goto(invoiceHref);
  await expect(member.getByText("Invoice not found")).toBeVisible();
  await expect(member.getByText("700.00 EUR")).toHaveCount(0);

  // Admins (the owner) may open members' bookings; uploads are deleted by the uploader or an admin.
  const memberBooking = await createBooking(member, {
    customer: "Lisbon Car Traders",
    carrier: "Atlantic Car Carriers",
    legs: [{ from: "Setúbal", to: "Santos" }],
  });
  await expect(
    member.getByRole("heading", { name: /^BK-\d{6}$/ }),
  ).toBeVisible();
  await uploadAttachment(member, pdf("member-receipt.pdf"));
  const memberFile = await member
    .getByTestId("attachment-row")
    .getByRole("link", { name: "Download" })
    .getAttribute("href");
  await owner.goto(`/bookings/${memberBooking}`);
  await expect(owner.getByText("Lisbon Car Traders").first()).toBeVisible();
  await uploadAttachment(owner, pdf("admin-note.pdf"));
  const adminFile = await owner
    .getByTestId("attachment-row")
    .filter({ hasText: "admin-note.pdf" })
    .getByRole("link", { name: "Download" })
    .getAttribute("href");
  expect((await runtime.fetch(adminFile, { role: "member" })).status).toBe(200);
  expect(
    (await runtime.fetch(adminFile, { role: "member", method: "DELETE" }))
      .status,
  ).toBe(403);
  expect((await runtime.fetch(adminFile, { role: "member" })).status).toBe(200);
  expect(
    (await runtime.fetch(memberFile, { role: "owner", method: "DELETE" }))
      .status,
  ).toBe(204);
  expect((await runtime.fetch(memberFile, { role: "member" })).status).toBe(
    404,
  );

  // Tariff rules are admin-only to change; members see them read-only.
  await owner.goto("/tariffs");
  await owner.getByRole("button", { name: "New tariff" }).click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Charge name").fill("Terminal handling");
  await dialog.getByLabel("Basis").selectOption("per_booking");
  await dialog.getByLabel("Amount").fill("110");
  await dialog.getByLabel("Currency").fill("EUR");
  const createTariff = await captureServerCall(owner, () =>
    dialog.getByRole("button", { name: "Save tariff" }).click(),
  );
  await expect(owner.getByTestId("tariff-row")).toHaveCount(1);
  const count = async () =>
    (await db.prepare("SELECT COUNT(*) AS n FROM tariffs").first()).n;
  expect(await count()).toBe(1);
  await member.goto("/tariffs");
  await expect(member.getByTestId("tariff-row")).toHaveCount(1);
  await expect(member.getByRole("button", { name: "New tariff" })).toHaveCount(
    0,
  );
  await expect(
    member.getByTestId("tariff-row").getByRole("button", { name: "Edit" }),
  ).toHaveCount(0);
  await replay(runtime, createTariff, "member");
  expect(await count()).toBe(1);
  await replay(runtime, createTariff, "owner");
  expect(await count()).toBe(2);

  // Tracking: only the owner of the booking (or an admin) controls the link.
  await member.goto(`/bookings/${memberBooking}`);
  await member.getByRole("button", { name: "Create tracking link" }).click();
  const memberTrack = new URL(
    await member.getByTestId("tracking-url").textContent(),
  ).pathname;
  await owner.goto(`/bookings/${ownerBooking}`);
  const enable = await captureServerCall(owner, () =>
    owner.getByRole("button", { name: "Create tracking link" }).click(),
  );
  const ownerTrack = new URL(
    await owner.getByTestId("tracking-url").textContent(),
  ).pathname;
  await replay(runtime, enable, "member");
  expect((await runtime.fetch(ownerTrack)).status).toBe(200);

  // The public page shows tracking facts only, to anyone, and nothing for unknown tokens.
  const pub = await runtime.fetch(ownerTrack);
  expect(pub.status).toBe(200);
  const html = await pub.text();
  expect(html).toContain("YV1XZ12A1N1000001");
  for (const hidden of [
    "Fjord Auto AS",
    "logistics@fjordauto.example",
    "Owner-only cargo note",
    "customs-entry",
    "700.00",
    "owner@example.test",
    ownerBooking,
  ]) {
    expect(html).not.toContain(hidden);
  }
  expect((await runtime.fetch(memberTrack)).status).toBe(200);
  expect((await runtime.fetch("/t/not-a-real-token-000000000000")).status).toBe(
    404,
  );
  const visitor = await newPage(runtime, null);
  await visitor.goto(ownerTrack);
  await expect(visitor.getByTestId("tracking-status")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "All apps" })).toHaveCount(0);
  // Anonymous visitors reach nothing else.
  for (const path of [
    `/bookings/${ownerBooking}`,
    "/tariffs",
    invoiceHref,
    `/bookings/${ownerBooking}/bill-of-lading`,
  ]) {
    expect([401, 403, 302, 303, 307]).toContain(
      (await runtime.fetch(path)).status,
    );
  }
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
