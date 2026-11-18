// Persistence: bookings, vehicles, events, tariffs and files survive a restart.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import {
  addVehicle,
  createBooking,
  expect,
  newPage,
  pdf,
  uploadAttachment,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  let page = await newPage(runtime, "owner");
  const id = await createBooking(page, {
    customer: "Baltic Fleet Remarketing",
    carrier: "Nordic RoRo Line",
    vessel: "Polar Bridge",
    voyage: "PB-120",
    legs: [
      {
        from: "Gothenburg",
        to: "Zeebrugge",
        etd: "2026-12-03",
        eta: "2026-12-05",
      },
      {
        from: "Zeebrugge",
        to: "Portbury",
        etd: "2026-12-06",
        eta: "2026-12-07",
      },
    ],
  });
  await addVehicle(page, {
    vin: "YV1XZ12A1N1000777",
    make: "Volvo",
    model: "XC40",
    year: 2022,
    weight: 1700,
  });
  await page.getByLabel("Status", { exact: true }).selectOption("loaded");
  await page.getByLabel("Location").fill("Gothenburg");
  await page.getByRole("button", { name: "Record status" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText(
    "Loaded / en route",
  );
  await uploadAttachment(page, pdf("bill-scan.pdf", "Scanned bill PB-120"));
  const file = await page
    .getByTestId("attachment-row")
    .getByRole("link", { name: "Download" })
    .getAttribute("href");
  await page.goto("/tariffs");
  await page.getByRole("button", { name: "New tariff" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Charge name").fill("BAF surcharge");
  await dialog.getByLabel("Basis").selectOption("per_unit");
  await dialog.getByLabel("Amount").fill("62.5");
  await dialog.getByLabel("Currency").fill("EUR");
  await dialog.getByRole("button", { name: "Save tariff" }).click();
  await expect(page.getByTestId("tariff-row")).toHaveCount(1);
  await page.context().close();

  await runtime.restart();

  page = await newPage(runtime, "owner");
  await page.goto(`/bookings/${id}`);
  await expect(page.getByRole("heading", { name: "BK-000001" })).toBeVisible();
  await expect(page.getByTestId("booking-status")).toHaveText(
    "Loaded / en route",
  );
  await expect(page.getByTestId("leg-row")).toHaveCount(2);
  await expect(
    page.getByTestId("vehicle-row").filter({ hasText: "YV1XZ12A1N1000777" }),
  ).toBeVisible();
  await expect(page.getByTestId("status-event")).toHaveCount(2);
  await expect(
    page.getByTestId("attachment-row").filter({ hasText: "bill-scan.pdf" }),
  ).toBeVisible();
  const download = await runtime.fetch(file, { role: "owner" });
  expect(download.status).toBe(200);
  expect(await download.text()).toContain("Scanned bill PB-120");
  await page.goto("/tariffs");
  await expect(
    page.getByTestId("tariff-row").filter({ hasText: "BAF surcharge" }),
  ).toContainText("62.50 EUR");
  // The next booking continues the sequence.
  await createBooking(page, {
    customer: "Second customer",
    legs: [{ from: "Emden", to: "Dublin" }],
  });
  await expect(page.getByRole("heading", { name: "BK-000002" })).toBeVisible();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
