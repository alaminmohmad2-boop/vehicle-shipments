import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.files), never the file.
export default defineEveryApp({
  id: "vehicle-shipments",
  name: "Vehicle Shipments",
  description:
    "Book, track and invoice vehicle shipments by VIN, with multi-port routes, bills of lading and a tracking link for customers.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    // Booking attachments: customs papers, dock receipts, delivery notes.
    r2: ["files"],
  },
  // Every member works on their own bookings; owners and admins see all of
  // them and keep the tariff rules.
  access: "everyone",
  public: [
    // A booking's tracking page, opened by its token. Revoking the token
    // makes the page a 404 (src/server/tracking.ts).
    { path: "/t/:token", methods: ["GET"] },
  ],
  // The built scripts and styles the tracking page loads, and the icon.
  publicAssets: ["/assets/**", "/icon.svg"],
});
