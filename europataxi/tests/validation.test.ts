import assert from "node:assert/strict";
import test from "node:test";
import {
  contactSchema,
  createBookingSchema,
  createTripSchema,
  issuesToFieldErrors,
  normalizePhone,
} from "@/lib/validation";
import type { FieldError } from "@/types";

/** Testlerde sabit "bugün"; şartnamedeki örnek rezervasyon tarihinden (2026-10-02) önce. */
const TODAY = "2026-09-01";

/** Geçerli bir rota; her testte yalnızca sınanan alan bozulur. */
const VALID_TRIP = {
  from: "bru-airport",
  to: "paris",
  date: "2026-10-02",
  time: "14:30",
  passengers: 2,
  luggage: 3,
  return: null,
};

/** Şartname bölüm 5'teki örnek booking JSON'u. */
const SAMPLE_BOOKING = {
  trip: {
    from: "bru-airport",
    to: "paris",
    date: "2026-10-02",
    time: "14:30",
    passengers: 2,
    luggage: 3,
    return: null,
  },
  vehicle: "sedan",
  customer: {
    firstName: "Ayşe",
    lastName: "Yılmaz",
    email: "ayse@example.com",
    phone: "+32470000000",
    flightNumber: "TK1937",
    note: "",
    consent: true,
  },
  locale: "tr",
};

function tripErrors(trip: unknown): FieldError[] {
  const result = createTripSchema(TODAY).safeParse(trip);
  assert.equal(result.success, false, "rota şeması bu girdiyi kabul etmemeliydi");
  return result.success ? [] : issuesToFieldErrors(result.error.issues);
}

function bookingErrors(booking: unknown): FieldError[] {
  const result = createBookingSchema(TODAY).safeParse(booking);
  assert.equal(result.success, false, "rezervasyon şeması bu girdiyi kabul etmemeliydi");
  return result.success ? [] : issuesToFieldErrors(result.error.issues);
}

function messageFor(errors: FieldError[], path: string): string {
  const error = errors.find((item) => item.path === path);
  assert.ok(error, `"${path}" alanında hata bekleniyordu, gelenler: ${errors.map((e) => e.path).join(", ")}`);
  return error.message;
}

test("rota şeması aynı kalkış ve varış yerini reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, from: "paris", to: "paris" });
  assert.equal(messageFor(errors, "to"), "validation.sameLocation");
});

test("rota şeması geçmiş tarihi reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, date: "2026-08-31" });
  assert.equal(messageFor(errors, "date"), "validation.pastDate");
});

test("rota şeması 15 dakikalık aralık dışındaki saati reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, time: "14:20" });
  assert.equal(messageFor(errors, "time"), "validation.invalidTime");
});

test("rota şeması gidişten önceki dönüşü reddeder", () => {
  const errors = tripErrors({
    ...VALID_TRIP,
    return: { date: "2026-10-02", time: "12:00" },
  });
  assert.equal(messageFor(errors, "return.date"), "validation.returnBeforeOutbound");
});

test("rota şeması 17 yolcuyu reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, passengers: 17 });
  assert.equal(messageFor(errors, "passengers"), "validation.passengersRange");
});

test("rota şeması 21 bagajı reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, luggage: 21 });
  assert.equal(messageFor(errors, "luggage"), "validation.luggageRange");
});

test("rota şeması bilinmeyen konum kimliğini reddeder", () => {
  const errors = tripErrors({ ...VALID_TRIP, from: "atlantis" });
  assert.equal(messageFor(errors, "from"), "validation.unknownLocation");
});

test("rezervasyon şeması şartnamedeki örnek JSON'u kabul eder", () => {
  const result = createBookingSchema(TODAY).safeParse(SAMPLE_BOOKING);
  assert.ok(result.success, `örnek JSON reddedildi: ${result.success ? "" : JSON.stringify(result.error.issues)}`);

  const booking = result.data;
  assert.equal(booking.trip.from, "bru-airport");
  assert.equal(booking.trip.to, "paris");
  assert.equal(booking.trip.date, "2026-10-02");
  assert.equal(booking.trip.time, "14:30");
  assert.equal(booking.trip.passengers, 2);
  assert.equal(booking.trip.luggage, 3);
  assert.equal(booking.trip.return, null);
  assert.equal(booking.vehicle, "sedan");
  assert.equal(booking.customer.firstName, "Ayşe");
  assert.equal(booking.customer.lastName, "Yılmaz");
  assert.equal(booking.customer.email, "ayse@example.com");
  assert.equal(booking.customer.phone, "+32470000000");
  assert.equal(booking.customer.flightNumber, "TK1937");
  assert.equal(booking.customer.note, "");
  assert.equal(booking.customer.consent, true);
  assert.equal(booking.locale, "tr");
});

test("rezervasyon şeması kapasiteyi aşan van seçimini vehicle alanında reddeder", () => {
  const errors = bookingErrors({
    ...SAMPLE_BOOKING,
    trip: { ...SAMPLE_BOOKING.trip, passengers: 9 },
    vehicle: "van",
  });
  assert.equal(messageFor(errors, "vehicle"), "validation.vehicleCapacity");
});

test("rezervasyon şeması onay kutusu işaretlenmediğinde reddeder", () => {
  const errors = bookingErrors({
    ...SAMPLE_BOOKING,
    customer: { ...SAMPLE_BOOKING.customer, consent: false },
  });
  assert.equal(messageFor(errors, "customer.consent"), "validation.consentRequired");
});

test("rezervasyon şeması bozuk e-posta adresini reddeder", () => {
  const errors = bookingErrors({
    ...SAMPLE_BOOKING,
    customer: { ...SAMPLE_BOOKING.customer, email: "ayse@example" },
  });
  assert.equal(messageFor(errors, "customer.email"), "validation.emailInvalid");
});

test("boşluklu telefon numarası +32470000000 biçimine normalleşir", () => {
  assert.equal(normalizePhone("+32 470 00 00 00"), "+32470000000");

  const result = createBookingSchema(TODAY).safeParse({
    ...SAMPLE_BOOKING,
    customer: { ...SAMPLE_BOOKING.customer, phone: "+32 470 00 00 00" },
  });
  assert.ok(result.success, "boşluklu telefon numarası reddedildi");
  assert.equal(result.data.customer.phone, "+32470000000");
});

test("iletişim şeması 10 karakterden kısa mesajı reddeder", () => {
  const result = contactSchema.safeParse({
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "+32470000000",
    subject: "booking",
    message: "Merhaba",
    consent: true,
    locale: "tr",
  });
  assert.equal(result.success, false, "kısa mesaj kabul edilmemeliydi");
  const errors = result.success ? [] : issuesToFieldErrors(result.error.issues);
  assert.equal(messageFor(errors, "message"), "validation.messageTooShort");
});

test("iletişim şeması bilinmeyen konuyu reddeder", () => {
  const result = contactSchema.safeParse({
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "+32470000000",
    subject: "sikayet",
    message: "Havalimanı transferi için bilgi almak istiyorum.",
    consent: true,
    locale: "tr",
  });
  assert.equal(result.success, false, "bilinmeyen konu kabul edilmemeliydi");
  const errors = result.success ? [] : issuesToFieldErrors(result.error.issues);
  assert.equal(messageFor(errors, "subject"), "validation.subjectRequired");
});
