import { describe, expect, test } from "bun:test";
import { eventQuerySchema, eventSchema, eventUpdateSchema } from "./event.schema.js";

const event = { title: "Navratri Night", description: "Traditional garba celebration", venueName: "Town Hall", addressLine: "Main Road", city: "Ahmedabad", state: "Gujarat", latitude: 23.0225, longitude: 72.5714, startsAt: "2027-10-01T18:00:00.000Z", endsAt: "2027-10-01T22:00:00.000Z", entryFeePaise: 50000 };

describe("event validation", () => {
  test("defaults new events to draft", () => expect(eventSchema.parse(event).status).toBe("DRAFT"));
  test("rejects reversed dates", () => expect(() => eventSchema.parse({ ...event, endsAt: "2027-10-01T17:00:00.000Z" })).toThrow("endsAt"));
  test("rejects invalid coordinates and negative fee", () => {
    expect(() => eventSchema.parse({ ...event, latitude: 91 })).toThrow();
    expect(() => eventSchema.parse({ ...event, entryFeePaise: -1 })).toThrow();
  });
  test("patch does not inject a draft status", () => expect(eventUpdateSchema.parse({ title: "Updated title" })).toEqual({ title: "Updated title" }));

  test("eventQuerySchema validates and coerces filters correctly", () => {
    const query = eventQuerySchema.parse({
      page: "2",
      limit: "10",
      search: "Dandiya",
      state: "Gujarat",
      city: "Surat",
      minFeePaise: "0",
      maxFeePaise: "100000",
      isFree: "false",
      sortBy: "fee_asc",
    });

    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.search).toBe("Dandiya");
    expect(query.state).toBe("Gujarat");
    expect(query.city).toBe("Surat");
    expect(query.sortBy).toBe("fee_asc");
    expect(query.isFree).toBe(false);
  });
});
