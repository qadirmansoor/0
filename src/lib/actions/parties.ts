"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { PartyType } from "@/generated/prisma/enums";

export async function createParty(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as PartyType;
  const email = String(formData.get("email") ?? "") || null;
  const phone = String(formData.get("phone") ?? "") || null;
  const address = String(formData.get("address") ?? "") || null;

  if (!name || !type) {
    throw new Error("Name and type are required.");
  }

  await prisma.party.create({ data: { name, type, email, phone, address } });

  revalidatePath("/parties");
  redirect("/parties");
}

export async function updateParty(partyId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "") || null;
  const phone = String(formData.get("phone") ?? "") || null;
  const address = String(formData.get("address") ?? "") || null;
  const isActive = formData.get("isActive") === "on";

  await prisma.party.update({
    where: { id: partyId },
    data: { name, email, phone, address, isActive },
  });

  revalidatePath("/parties");
  redirect("/parties");
}
