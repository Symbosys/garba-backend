import { describe, expect, test } from "bun:test";
import { eventQuerySchema, eventSchema, eventUpdateSchema, slotInputSchema, slotUpdateSchema } from "./event.schema.js";

const sampleSlot = {
  title: "Day 1 - Opening Pass",
  slotDate: "2027-10-01",
  startTime: "2027-10-01T18:00:00.000Z",
  endTime: "2027-10-01T23:00:00.000Z",
  entryFee: 500,
  currency: "INR",
  capacity: 1000,
};

const sampleEvent = {
  title: "Navratri Maha Garba Festival",
  description: "Traditional 9-night garba celebration with live folk orchestra and authentic dandiya.",
  venueName: "Town Hall Arena",
  addressLine: "Opposite Riverfront Promenade",
  city: "Ahmedabad",
  state: "Gujarat",
  postalCode: "380001",
  latitude: 23.0225,
  longitude: 72.5714,
  capacity: 5000,
  contactEmail: "info@mahagarba.com",
  contactPhone: "+919876543210",
  slots: [sampleSlot],
};

describe("event and slot validation", () => {
  test("successfully validates event with single slot and defaults status to DRAFT", () => {
    const parsed = eventSchema.parse(sampleEvent);
    expect(parsed.status).toBe("DRAFT");
    expect(parsed.slots).toHaveLength(1);
    expect(parsed.slots![0]!.title).toBe("Day 1 - Opening Pass");
    expect(parsed.slots![0]!.entryFee).toBe(500);
    expect(parsed.slots![0]!.currency).toBe("INR");
  });

  test("successfully validates event with multiple slots", () => {
    const multiSlotEvent = {
      ...sampleEvent,
      slots: [
        sampleSlot,
        {
          title: "Day 2 - Weekend Pass",
          slotDate: "2027-10-02",
          startTime: "2027-10-02T18:00:00.000Z",
          endTime: "2027-10-02T23:59:00.000Z",
          entryFee: 750,
          currency: "INR",
          capacity: 1500,
        },
      ],
    };
    const parsed = eventSchema.parse(multiSlotEvent);
    expect(parsed.slots).toHaveLength(2);
    expect(parsed.slots![1]!.entryFee).toBe(750);
  });

  test("parses slots passed as a JSON string (e.g. from multipart form-data)", () => {
    const stringifiedSlotsEvent = {
      ...sampleEvent,
      slots: JSON.stringify([sampleSlot]),
    };
    const parsed = eventSchema.parse(stringifiedSlotsEvent);
    expect(parsed.slots).toHaveLength(1);
    expect(parsed.slots![0]!.entryFee).toBe(500);
  });

  test("rejects event when slots array is empty or missing", () => {
    expect(() => eventSchema.parse({ ...sampleEvent, slots: [] })).toThrow();
  });

  test("rejects slot with reversed start and end times", () => {
    const invalidSlotEvent = {
      ...sampleEvent,
      slots: [
        {
          ...sampleSlot,
          startTime: "2027-10-01T23:00:00.000Z",
          endTime: "2027-10-01T18:00:00.000Z",
        },
      ],
    };
    expect(() => eventSchema.parse(invalidSlotEvent)).toThrow("endTime");
  });

  test("rejects negative entry fee and invalid coordinates", () => {
    expect(() =>
      eventSchema.parse({
        ...sampleEvent,
        latitude: 95,
      })
    ).toThrow();

    expect(() =>
      eventSchema.parse({
        ...sampleEvent,
        slots: [{ ...sampleSlot, entryFee: -10 }],
      })
    ).toThrow();
  });

  test("allows free entry fee (entryFee: 0)", () => {
    const freeEvent = {
      ...sampleEvent,
      slots: [{ ...sampleSlot, entryFee: 0 }],
    };
    const parsed = eventSchema.parse(freeEvent);
    expect(parsed.slots![0]!.entryFee).toBe(0);
  });

  test("eventUpdateSchema allows partial updates with and without slots", () => {
    const titleOnly = eventUpdateSchema.parse({ title: "Renamed Dandiya Night" });
    expect(titleOnly).toEqual({ title: "Renamed Dandiya Night" });

    const withUpdatedSlots = eventUpdateSchema.parse({
      venueName: "New Arena",
      slots: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          slotDate: "2027-10-05",
          startTime: "2027-10-05T19:00:00.000Z",
          endTime: "2027-10-05T23:00:00.000Z",
          entryFee: 600,
        },
      ],
    });
    expect(withUpdatedSlots.venueName).toBe("New Arena");
    expect(withUpdatedSlots.slots).toHaveLength(1);
    expect(withUpdatedSlots.slots![0]!.entryFee).toBe(600);
  });

  test("slotInputSchema and slotUpdateSchema validate single slots independently", () => {
    const validSlot = slotInputSchema.parse({
      title: "VIP Entry",
      slotDate: "2027-10-08",
      startTime: "2027-10-08T18:00:00.000Z",
      endTime: "2027-10-08T23:30:00.000Z",
      entryFee: 1500,
    });
    expect(validSlot.entryFee).toBe(1500);
    expect(validSlot.currency).toBe("INR");

    const partialSlot = slotUpdateSchema.parse({
      entryFee: 2000,
      title: "Updated VIP Pass",
    });
    expect(partialSlot.entryFee).toBe(2000);
    expect(partialSlot.title).toBe("Updated VIP Pass");
  });

  test("eventQuerySchema parses and coerces query parameters", () => {
    const query = eventQuerySchema.parse({
      page: "3",
      limit: "15",
      search: "Garba",
      state: "Gujarat",
      city: "Ahmedabad",
      minFee: "100",
      maxFee: "1000",
      isFree: "false",
      sortBy: "newest",
    });

    expect(query.page).toBe(3);
    expect(query.limit).toBe(15);
    expect(query.search).toBe("Garba");
    expect(query.minFee).toBe(100);
    expect(query.maxFee).toBe(1000);
    expect(query.isFree).toBe(false);
    expect(query.sortBy).toBe("newest");
  });
});

