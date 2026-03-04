import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@kirana.local" },
    update: {},
    create: {
      email: "admin@kirana.local",
      name: "Platform Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@kirana.local" },
    update: {},
    create: {
      email: "customer@kirana.local",
      name: "Priya Sharma",
      role: "CUSTOMER",
      passwordHash,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@kirana.local" },
    update: {},
    create: {
      email: "owner@kirana.local",
      name: "Ramesh General Store",
      role: "STORE_OWNER",
      passwordHash,
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: "delivery@kirana.local" },
    update: {},
    create: {
      email: "delivery@kirana.local",
      name: "Amit Delivery",
      role: "DELIVERY",
      passwordHash,
    },
  });

  const store = await prisma.store.upsert({
    where: { ownerId: owner.id },
    update: {
      isApproved: true,
      lat: 19.076,
      lng: 72.8777,
    },
    create: {
      ownerId: owner.id,
      name: "Ramesh General Store",
      description: "Fresh groceries, staples, and daily needs — 15–30 min delivery.",
      address: "Plot 12, Link Road, Bandra West, Mumbai",
      lat: 19.076,
      lng: 72.8777,
      isApproved: true,
    },
  });

  const products = [
    { name: "Tata Salt (1 kg)", priceCents: 2800, stock: 80, description: "Iodized salt" },
    { name: "Aashirvaad Atta (5 kg)", priceCents: 26500, stock: 40, description: "Whole wheat flour" },
    { name: "Fortune Sunflower Oil (1 L)", priceCents: 14500, stock: 55, description: "Refined oil" },
    { name: "Amul Milk (500 ml)", priceCents: 2800, stock: 100, description: "Toned milk" },
    { name: "Toor Dal (1 kg)", priceCents: 13200, stock: 30, description: "Split pigeon peas" },
    { name: "Surf Excel Matic (1 kg)", priceCents: 21000, stock: 25, description: "Detergent powder" },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, name: p.name },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          storeId: store.id,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          stock: p.stock,
        },
      });
    }
  }

  await prisma.deliveryPartnerProfile.upsert({
    where: { userId: partner.id },
    update: { isAvailable: true, vehicleInfo: "Honda Activa — MH01 AB 1234" },
    create: {
      userId: partner.id,
      isAvailable: true,
      vehicleInfo: "Honda Activa — MH01 AB 1234",
    },
  });

  const store2Owner = await prisma.user.upsert({
    where: { email: "owner2@kirana.local" },
    update: {},
    create: {
      email: "owner2@kirana.local",
      name: "Lakshmi Kirana",
      role: "STORE_OWNER",
      passwordHash,
    },
  });

  await prisma.store.upsert({
    where: { ownerId: store2Owner.id },
    update: { isApproved: true, lat: 19.0544, lng: 72.8406 },
    create: {
      ownerId: store2Owner.id,
      name: "Lakshmi Kirana",
      description: "Snacks, beverages, and household essentials.",
      address: "Shop 4, Carter Road, Bandra West, Mumbai",
      lat: 19.0544,
      lng: 72.8406,
      isApproved: true,
    },
  });

  console.log("Seed OK. Demo logins (password: password123):");
  console.log({
    admin: admin.email,
    customer: customer.email,
    storeOwner: owner.email,
    delivery: partner.email,
    secondStore: store2Owner.email,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
