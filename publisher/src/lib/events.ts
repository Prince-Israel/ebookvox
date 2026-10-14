import { db } from "./db";

/** Facts the Admin platform wants to be told about (it pulls them with a cursor). Never throws. */
export async function emitEvent(type: string, data: object) {
  try {
    await db.serviceEvent.create({ data: { type, payload: JSON.stringify(data) } });
  } catch (e) {
    console.error("[events]", e);
  }
}
