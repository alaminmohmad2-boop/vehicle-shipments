// Behavior: every retained feature's main path, run against the release archive.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import {
  addVehicle,
  createBooking,
  expect,
  fillVehicle,
  newPage,
  pdf,
  uploadAttachment,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  const page = await newPage(runtime, "owner");

  // F004: the admin keeps tariff rules.
  await page.goto("/tariffs");
  await expect(page.getByRole("heading", { name: "Tariffs" })).toBeVisible();
  const tariffs = [
    {
      name: "Ocean freight",
      basis: "per_unit",
      amount: "850",
      currency: "USD",
      carrier: "Nordic RoRo Line",
    },
    {
      name: "Terminal handling",
      basis: "per_booking",
      amount: "120",
      currency: "USD",
    },
    {
      name: "Storage",
      basis: "per_day",
      amount: "25",
      currency: "USD",
      origin: "Bremerhaven",
    },
    {
      name: "Port dues",
      basis: "per_unit",
      amount: "40",
      currency: "USD",
      carrier: "Atlantic Car Carriers",
    },
  ];
  for (const tariff of tariffs) {
    await page.getByRole("button", { name: "New tariff" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Charge name").fill(tariff.name);
    await dialog.getByLabel("Basis").selectOption(tariff.basis);
    await dialog.getByLabel("Amount").fill(tariff.amount);
    await dialog.getByLabel("Currency").fill(tariff.currency);
    await dialog.getByLabel("Carrier").fill(tariff.carrier ?? "");
    await dialog.getByLabel("Origin port").fill(tariff.origin ?? "");
    await dialog.getByLabel("Destination port").fill("");
    await dialog.getByRole("button", { name: "Save tariff" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByTestId("tariff-row")).toHaveCount(4);
  await expect(
    page.getByTestId("tariff-row").filter({ hasText: "Ocean freight" }),
  ).toContainText("850.00 USD");
  // Edit and delete a rule.
  const dues = page.getByTestId("tariff-row").filter({ hasText: "Port dues" });
  await dues.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Amount").fill("45");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save tariff" })
    .click();
  await expect(dues).toContainText("45.00 USD");

  // F001: a booking with a multi-leg route; inline validation first.
  await page.goto("/bookings/new");
  await page.getByLabel("Customer email").fill("not-an-email");
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByText("Enter the customer's name")).toBeVisible();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByText("Enter the port of loading")).toBeVisible();

  const bookingId = await createBooking(page, {
    customer: "Harbor Auto Export GmbH",
    email: "ops@harborauto.example",
    consignee: "Gulf Coast Motors LLC",
    carrier: "Nordic RoRo Line",
    vessel: "Aurora Highway",
    voyage: "AH-2611",
    notes: "Keys in ignition, fuel below quarter tank",
    legs: [
      {
        from: "Bremerhaven",
        to: "Southampton",
        vesselVoyage: "Aurora Highway AH-2611",
        etd: "2026-12-02",
        eta: "2026-12-04",
      },
      {
        from: "Southampton",
        to: "Baltimore",
        vesselVoyage: "Aurora Highway AH-2611",
        etd: "2026-12-05",
        eta: "2026-12-16",
      },
    ],
  });
  await expect(page.getByRole("heading", { name: "BK-000001" })).toBeVisible();
  await expect(page.getByTestId("booking-status")).toHaveText("Booked");
  await expect(page.getByTestId("leg-row")).toHaveCount(2);

  // Vehicles: inline VIN errors, add, edit, remove.
  await page.getByRole("button", { name: "Add vehicle" }).click();
  let dialog = page.getByRole("dialog");
  await fillVehicle(dialog, {
    vin: "WVWZZZ1KZBWI00001",
    make: "Volkswagen",
    model: "Golf",
  });
  await dialog.getByRole("button", { name: "Save vehicle" }).click();
  await expect(
    dialog.getByText("17 letters and digits, without I, O or Q"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  const vehicles = [
    {
      vin: "WVWZZZ1KZBW000001",
      make: "Volkswagen",
      model: "Golf",
      year: 2021,
      length: 428,
      width: 179,
      height: 149,
      weight: 1320,
    },
    {
      vin: "5YJ3E1EA7KF317001",
      make: "Tesla",
      model: "Model 3",
      year: 2019,
      length: 469,
      width: 185,
      height: 144,
      weight: 1610,
    },
    {
      vin: "JTDKN3DU5A0123456",
      make: "Toyota",
      model: "Prius",
      year: 2010,
      length: 446,
      width: 175,
      height: 149,
      weight: 1380,
    },
  ];
  for (const vehicle of vehicles) await addVehicle(page, vehicle);
  await expect(page.getByTestId("vehicle-row")).toHaveCount(3);

  await page.getByRole("button", { name: "Add vehicle" }).click();
  dialog = page.getByRole("dialog");
  await fillVehicle(dialog, {
    vin: "5yj3e1ea7kf317001",
    make: "Tesla",
    model: "Model 3",
  });
  await dialog.getByRole("button", { name: "Save vehicle" }).click();
  await expect(
    dialog.getByText("This VIN is already on the booking"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  const prius = page
    .getByTestId("vehicle-row")
    .filter({ hasText: "JTDKN3DU5A0123456" });
  await prius.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Year").fill("2011");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save vehicle" })
    .click();
  await expect(prius).toContainText("2011");
  await prius.getByRole("button", { name: "Remove" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove vehicle" })
    .click();
  await expect(page.getByTestId("vehicle-row")).toHaveCount(2);

  // Legs: add a relay, edit it, remove it.
  await page.getByRole("button", { name: "Add leg" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("From port").fill("Baltimore");
  await dialog.getByLabel("To port").fill("Houston");
  await dialog.getByLabel("ETD").fill("2026-12-18");
  await dialog.getByRole("button", { name: "Save leg" }).click();
  await expect(page.getByTestId("leg-row")).toHaveCount(3);
  const relay = page.getByTestId("leg-row").filter({ hasText: "Houston" });
  await relay.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("To port").fill("Galveston");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save leg" })
    .click();
  await expect(
    page.getByTestId("leg-row").filter({ hasText: "Galveston" }),
  ).toBeVisible();
  await page
    .getByTestId("leg-row")
    .filter({ hasText: "Galveston" })
    .getByRole("button", { name: "Remove" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove leg" })
    .click();
  await expect(page.getByTestId("leg-row")).toHaveCount(2);

  // Edit booking fields.
  await page.getByRole("button", { name: "Edit details" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Voyage", { exact: true }).fill("AH-2612");
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("booking-details")).toContainText("AH-2612");

  // F002: status events and a vehicle's own status.
  await page
    .getByLabel("Status", { exact: true })
    .selectOption("customs_cleared");
  await page.getByLabel("Date and time").fill("2026-11-30T14:15");
  await page.getByLabel("Location").fill("Bremerhaven");
  await page.getByLabel("Note").fill("Export declaration released");
  await page.getByRole("button", { name: "Record status" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText(
    "Customs cleared",
  );
  await expect(page.getByTestId("status-event")).toHaveCount(2);
  await expect(
    page
      .getByTestId("status-event")
      .filter({ hasText: "Export declaration released" }),
  ).toContainText("Bremerhaven");

  const golf = page
    .getByTestId("vehicle-row")
    .filter({ hasText: "WVWZZZ1KZBW000001" });
  await expect(golf.getByTestId("vehicle-status")).toHaveText(
    "Customs cleared",
  );
  await golf.getByRole("button", { name: "Edit" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Vehicle status")
    .selectOption("documents_ready");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save vehicle" })
    .click();
  await expect(golf.getByTestId("vehicle-status")).toHaveText(
    "Documents ready",
  );

  // F004: tariffs to charge lines, a manual line, invoice, paid, void.
  await page.getByRole("button", { name: "Apply tariffs" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Storage days").fill("3");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("charge-row")).toHaveCount(3);
  await expect(
    page.getByTestId("charge-row").filter({ hasText: "Ocean freight" }),
  ).toContainText("1,700.00 USD");
  await expect(
    page.getByTestId("charge-row").filter({ hasText: "Storage" }),
  ).toContainText("75.00 USD");
  await expect(
    page.getByTestId("charge-row").filter({ hasText: "Port dues" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Add charge" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Customs documentation");
  await dialog.getByLabel("Quantity").fill("1");
  await dialog.getByLabel("Unit price").fill("95");
  await dialog.getByLabel("Currency").fill("USD");
  await dialog.getByRole("button", { name: "Save charge" }).click();
  await expect(page.getByTestId("charge-row")).toHaveCount(4);

  await page.getByRole("button", { name: "Issue invoice" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Issue date").fill("2026-12-01");
  await dialog.getByLabel("Due date").fill("2026-12-31");
  await dialog.getByRole("button", { name: "Issue" }).click();
  await expect(dialog).toBeHidden();
  const invoiceRow = (number) =>
    page
      .getByTestId("invoice-row")
      .filter({ has: page.getByRole("cell", { name: number, exact: true }) });
  const first = invoiceRow("INV-000001");
  await expect(first).toContainText("1,990.00 USD");
  await expect(first).toContainText("Issued");
  await expect(page.getByTestId("invoiced-total")).toContainText(
    "1,990.00 USD",
  );
  await expect(page.getByTestId("open-balance")).toContainText("1,990.00 USD");

  await first.getByRole("button", { name: "Mark paid" }).click();
  await expect(first).toContainText("Paid");
  await expect(page.getByTestId("open-balance")).toContainText("0.00 USD");

  await page.getByRole("button", { name: "Add charge" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Re-delivery fee");
  await dialog.getByLabel("Quantity").fill("1");
  await dialog.getByLabel("Unit price").fill("60");
  await dialog.getByLabel("Currency").fill("USD");
  await dialog.getByRole("button", { name: "Save charge" }).click();
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Issue" }).click();
  const second = invoiceRow("INV-000002");
  await expect(second).toContainText("60.00 USD");
  await expect(page.getByTestId("open-balance")).toContainText("60.00 USD");
  await second.getByRole("button", { name: "Void" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Void invoice" })
    .click();
  await expect(second).toContainText("Voided");
  await expect(
    page.getByTestId("invoice-row").filter({ hasText: "CN-000001" }),
  ).toContainText("-60.00 USD");
  await expect(page.getByTestId("invoiced-total")).toContainText(
    "1,990.00 USD",
  );
  await expect(page.getByTestId("open-balance")).toContainText("0.00 USD");

  // F005: the invoice and bill of lading print views.
  const invoiceHref = await first
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  await page.goto(invoiceHref);
  await expect(
    page.getByRole("heading", { name: "Invoice INV-000001" }),
  ).toBeVisible();
  await expect(page.getByTestId("document-lines")).toContainText(
    "Ocean freight",
  );
  await expect(page.getByTestId("document-total")).toContainText(
    "1,990.00 USD",
  );
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

  await page.goto(`/bookings/${bookingId}/bill-of-lading`);
  await expect(
    page.getByRole("heading", { name: "Bill of lading BK-000001" }),
  ).toBeVisible();
  const bol = page.getByTestId("bill-of-lading");
  for (const text of [
    "Harbor Auto Export GmbH",
    "Gulf Coast Motors LLC",
    "Nordic RoRo Line",
    "Aurora Highway",
    "AH-2612",
    "Bremerhaven",
    "Baltimore",
    "WVWZZZ1KZBW000001",
    "469 × 185 × 144",
    "1,610",
  ]) {
    await expect(bol).toContainText(text);
  }

  // F005: attachments in R2, through the app's own routes.
  await page.goto(`/bookings/${bookingId}`);
  await uploadAttachment(
    page,
    pdf("dock-receipt-AH2612.pdf", "Dock receipt AH-2612"),
  );
  const attachment = page
    .getByTestId("attachment-row")
    .filter({ hasText: "dock-receipt-AH2612.pdf" });
  await expect(attachment).toContainText("PDF");
  await expect(attachment).toContainText("owner");
  const href = await attachment
    .getByRole("link", { name: "Download" })
    .getAttribute("href");
  const download = await runtime.fetch(href, { role: "owner" });
  expect(download.status).toBe(200);
  expect(await download.text()).toContain("Dock receipt AH-2612");

  const tooBig = new FormData();
  tooBig.append(
    "file",
    new Blob([new Uint8Array(21 * 1024 * 1024)], { type: "application/pdf" }),
    "huge.pdf",
  );
  expect(
    (
      await runtime.fetch(`/api/bookings/${bookingId}/attachments`, {
        role: "owner",
        method: "POST",
        body: tooBig,
      })
    ).status,
  ).toBe(413);
  const wrongType = new FormData();
  wrongType.append(
    "file",
    new Blob(["echo hi"], { type: "application/x-sh" }),
    "run.sh",
  );
  expect(
    (
      await runtime.fetch(`/api/bookings/${bookingId}/attachments`, {
        role: "owner",
        method: "POST",
        body: wrongType,
      })
    ).status,
  ).toBe(415);

  await uploadAttachment(page, {
    name: "delivery-note.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await page
    .getByTestId("attachment-row")
    .filter({ hasText: "delivery-note.png" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete file" })
    .click();
  await expect(page.getByTestId("attachment-row")).toHaveCount(1);

  // F006: a public tracking link.
  await page.getByRole("button", { name: "Create tracking link" }).click();
  const trackingUrl = await page.getByTestId("tracking-url").textContent();
  const tracking = new URL(trackingUrl);
  expect(tracking.hostname).toBe(runtime.hostname);
  expect(tracking.pathname).toMatch(/^\/t\/[A-Za-z0-9_-]{20,}$/);

  const visitor = await newPage(runtime, null);
  await visitor.goto(tracking.pathname);
  await expect(
    visitor.getByRole("heading", { name: "BK-000001" }),
  ).toBeVisible();
  await expect(visitor.getByTestId("tracking-status")).toHaveText(
    "Customs cleared",
  );
  await expect(visitor.getByTestId("tracking-leg")).toHaveCount(2);
  await expect(visitor.getByTestId("tracking-event")).toHaveCount(2);
  await expect(visitor.getByTestId("tracking-vehicle")).toHaveCount(2);
  await expect(
    visitor
      .getByTestId("tracking-vehicle")
      .filter({ hasText: "WVWZZZ1KZBW000001" }),
  ).toContainText("Documents ready");
  await visitor.getByLabel("Find a VIN").fill("317001");
  await expect(visitor.getByTestId("tracking-vehicle")).toHaveCount(1);
  await expect(visitor.getByTestId("tracking-vehicle")).toContainText(
    "Tesla Model 3",
  );
  const publicHtml = await (await runtime.fetch(tracking.pathname)).text();
  for (const hidden of [
    "1,700",
    "1,990",
    "ops@harborauto.example",
    "Keys in ignition",
    "Export declaration released",
    "dock-receipt",
    "INV-000001",
    "Harbor Auto Export",
  ]) {
    expect(publicHtml).not.toContain(hidden);
  }

  await page.getByRole("button", { name: "New link" }).click();
  await expect(page.getByTestId("tracking-url")).not.toHaveText(trackingUrl);
  const renewed = new URL(await page.getByTestId("tracking-url").textContent());
  expect(renewed.pathname).not.toBe(tracking.pathname);
  expect((await runtime.fetch(tracking.pathname)).status).toBe(404);
  expect((await runtime.fetch(renewed.pathname)).status).toBe(200);
  await page.getByRole("button", { name: "Turn off link" }).click();
  await expect(
    page.getByRole("button", { name: "Create tracking link" }),
  ).toBeVisible();
  expect((await runtime.fetch(renewed.pathname)).status).toBe(404);
  await visitor.goto(renewed.pathname);
  await expect(visitor.getByText("Tracking link not found")).toBeVisible();

  // F002: Delivered locks vehicles until reopened.
  await page.getByLabel("Status", { exact: true }).selectOption("delivered");
  await page.getByLabel("Date and time").fill("2026-12-17T11:00");
  await page.getByLabel("Location").fill("Baltimore");
  await page.getByRole("button", { name: "Record status" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Delivered");
  await expect(
    page.getByRole("button", { name: "Add vehicle" }),
  ).toBeDisabled();
  await expect(
    page
      .getByTestId("vehicle-row")
      .first()
      .getByRole("button", { name: "Edit" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByTestId("booking-status")).not.toHaveText("Delivered");
  await expect(page.getByRole("button", { name: "Add vehicle" })).toBeEnabled();

  // F001: delete a booking.
  const spareId = await createBooking(page, {
    customer: "Duplicate entry",
    legs: [{ from: "Zeebrugge", to: "Antwerp" }],
  });
  await page.getByRole("button", { name: "Delete booking" }).click();
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete booking" })
      .click(),
  ]);
  await expect(
    page.getByTestId("booking-row").filter({ hasText: "Duplicate entry" }),
  ).toHaveCount(0);
  await page.goto(`/bookings/${spareId}`);
  await expect(page.getByText("Booking not found")).toBeVisible();

  // F003: finder with search, filters, sorting and pagination.
  await createBooking(page, {
    customer: "Pacific Vehicle Logistics",
    carrier: "Atlantic Car Carriers",
    vessel: "Morning Celeste",
    legs: [
      { from: "Yokohama", to: "Tacoma", etd: "2027-01-10", eta: "2027-01-24" },
    ],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  const harbor = page
    .getByTestId("booking-row")
    .filter({ hasText: "BK-000001" });
  await expect(harbor).toContainText("Bremerhaven → Baltimore");
  await expect(harbor).toContainText("2");
  await page.getByLabel("Search").fill("317001");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await expect(page.getByTestId("booking-row")).toContainText("BK-000001");
  await page.getByLabel("Search").fill("Tacoma");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await expect(page.getByTestId("booking-row")).toContainText(
    "Pacific Vehicle Logistics",
  );
  await page.getByLabel("Search").fill("");
  await page
    .getByLabel("Carrier", { exact: true })
    .selectOption("Nordic RoRo Line");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await page.getByLabel("Carrier", { exact: true }).selectOption("");
  await page.getByLabel("Status", { exact: true }).selectOption("booked");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await expect(page.getByTestId("booking-row")).toContainText("BK-000003");
  await page.getByLabel("Status", { exact: true }).selectOption("");
  await page.getByLabel("Departs from").fill("2027-01-01");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await expect(page.getByTestId("booking-row")).toContainText("Yokohama");

  // Enough bookings for a second page, written as the owner's own rows.
  const db = await runtime.database();
  const owner = await db
    .prepare("SELECT owner_id, org_id FROM bookings LIMIT 1")
    .first();
  const seeds = [];
  for (let n = 10; n < 34; n++) {
    const id = crypto.randomUUID();
    seeds.push(
      db
        .prepare(
          "INSERT INTO bookings (id, org_id, owner_id, number, customer_name, carrier, vessel, voyage, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'booked')",
        )
        .bind(
          id,
          owner.org_id,
          owner.owner_id,
          `BK-0000${n}`,
          `Seeded customer ${n}`,
          "Nordic RoRo Line",
          "Aurora Highway",
          `AH-${n}`,
        ),
      db
        .prepare(
          "INSERT INTO legs (id, booking_id, position, from_port, to_port) VALUES (?, ?, 0, 'Bremerhaven', 'Baltimore')",
        )
        .bind(crypto.randomUUID(), id),
    );
  }
  await db.batch(seeds);
  await page.goto("/");
  await expect(page.getByTestId("booking-row")).toHaveCount(20);
  await expect(page.getByTestId("result-count")).toContainText("26");
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByTestId("booking-row")).toHaveCount(6);
  await page.getByRole("button", { name: "Sort by Booking" }).click();
  await expect(page.getByTestId("booking-row").first()).toContainText(
    "BK-000001",
  );
  await page.getByRole("button", { name: "Sort by Booking" }).click();
  await expect(page.getByTestId("booking-row").first()).toContainText(
    "BK-000033",
  );
  await page
    .getByTestId("booking-row")
    .first()
    .getByRole("link", { name: "BK-000033" })
    .click();
  await expect(page.getByRole("heading", { name: "BK-000033" })).toBeVisible();

  // Phone-sized smoke.
  const phone = await newPage(runtime, "owner", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto("/");
  await expect(phone.getByRole("heading", { name: "Bookings" })).toBeVisible();
  await expect(phone.getByRole("link", { name: "New booking" })).toBeVisible();
  await phone.goto(`/bookings/${bookingId}`);
  await expect(phone.getByTestId("vehicle-row")).toHaveCount(2);

  // The finished booking, as people see it.
  await page.goto(`/bookings/${bookingId}`);
  await expect(page.getByRole("heading", { name: "BK-000001" })).toBeVisible();
  await expect(page.getByTestId("vehicle-row")).toHaveCount(2);
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
