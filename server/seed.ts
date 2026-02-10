import { db } from "./db";
import { users, schools, userSchools } from "@shared/schema";

export async function seedDatabase() {
  const existingSchools = await db.select().from(schools);
  if (existingSchools.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with initial data...");

  const schoolData = [
    { name: "Escola Alpha - Centro", code: "ESC001", timezone: "America/Sao_Paulo" },
    { name: "Escola Alpha - Zona Sul", code: "ESC002", timezone: "America/Sao_Paulo" },
    { name: "Escola Alpha - Zona Norte", code: "ESC003", timezone: "America/Sao_Paulo" },
    { name: "Escola Alpha - Zona Oeste", code: "ESC004", timezone: "America/Sao_Paulo" },
    { name: "Escola Alpha - Campinas", code: "ESC005", timezone: "America/Sao_Paulo" },
    { name: "Escola Alpha - Ribeirão Preto", code: "ESC006", timezone: "America/Sao_Paulo" },
  ];

  const insertedSchools = await db.insert(schools).values(schoolData).returning();

  const adminUser = await db
    .insert(users)
    .values({
      email: "admin@placeholder.local",
      fullName: "Admin Placeholder",
      role: "admin",
      preferredLanguage: "pt-BR",
      isActive: true,
    })
    .returning();

  const directorUser = await db
    .insert(users)
    .values({
      email: "director@placeholder.local",
      fullName: "Director Placeholder",
      role: "director",
      schoolId: insertedSchools[0].id,
      preferredLanguage: "pt-BR",
      isActive: true,
    })
    .returning();

  const sellerUser = await db
    .insert(users)
    .values({
      email: "seller@placeholder.local",
      fullName: "Seller Placeholder",
      role: "seller",
      schoolId: insertedSchools[0].id,
      preferredLanguage: "pt-BR",
      isActive: true,
    })
    .returning();

  const execUser = await db
    .insert(users)
    .values({
      email: "exec@placeholder.local",
      fullName: "Executive Placeholder",
      role: "exec",
      preferredLanguage: "pt-BR",
      isActive: true,
    })
    .returning();

  const financeUser = await db
    .insert(users)
    .values({
      email: "finance@placeholder.local",
      fullName: "Finance Placeholder",
      role: "finance",
      preferredLanguage: "pt-BR",
      isActive: true,
    })
    .returning();

  await db.insert(userSchools).values([
    { userId: adminUser[0].id, schoolId: insertedSchools[0].id, role: "admin" },
    { userId: adminUser[0].id, schoolId: insertedSchools[1].id, role: "admin" },
    { userId: adminUser[0].id, schoolId: insertedSchools[2].id, role: "admin" },
    { userId: adminUser[0].id, schoolId: insertedSchools[3].id, role: "admin" },
    { userId: adminUser[0].id, schoolId: insertedSchools[4].id, role: "admin" },
    { userId: adminUser[0].id, schoolId: insertedSchools[5].id, role: "admin" },
    { userId: directorUser[0].id, schoolId: insertedSchools[0].id, role: "director" },
    { userId: sellerUser[0].id, schoolId: insertedSchools[0].id, role: "seller" },
    { userId: execUser[0].id, schoolId: insertedSchools[0].id, role: "exec" },
    { userId: execUser[0].id, schoolId: insertedSchools[1].id, role: "exec" },
    { userId: financeUser[0].id, schoolId: insertedSchools[0].id, role: "finance" },
    { userId: financeUser[0].id, schoolId: insertedSchools[1].id, role: "finance" },
  ]);

  console.log("Database seeded successfully!");
  console.log(`  - ${insertedSchools.length} schools created`);
  console.log(`  - 5 placeholder users created (admin, director, seller, exec, finance)`);
  console.log(`  - 12 user-school mappings created`);
}
