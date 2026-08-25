import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  try {
    await prisma.orderMessage.deleteMany();
  } catch {
    /* until migrated on some envs */
  }
  await prisma.rating.deleteMany();
  await prisma.deliveryProof.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  try {
    await prisma.platformFeeEntry.deleteMany();
    await prisma.platformInvoice.deleteMany();
  } catch {
    /* optional until migrated */
  }
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.promo.deleteMany();
  await prisma.service.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin Laundry",
      phone: "081111111111",
      email: "admin@laundry.com",
      password,
      role: "admin",
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Budi Santoso",
      phone: "082222222222",
      email: "budi@email.com",
      password,
      role: "customer",
    },
  });

  const courier = await prisma.user.create({
    data: {
      name: "Andi Kurir",
      phone: "083333333333",
      email: "andi@laundry.com",
      password,
      role: "courier",
      vehicle: "Motor Honda Beat",
      isOnline: true,
      rating: 4.8,
    },
  });

  const courier2 = await prisma.user.create({
    data: {
      name: "Rina Kurir",
      phone: "084444444444",
      email: "rina@laundry.com",
      password,
      role: "courier",
      vehicle: "Motor Yamaha NMAX",
      isOnline: false,
      rating: 4.9,
    },
  });

  // Outlet di Binuang (approximate)
  const outlet = await prisma.outlet.create({
    data: {
      name: "Laundry On-Demand Binuang",
      address: "Jl. Raya Binuang No. 10, Binuang, Kalimantan Selatan",
      latitude: -3.1634,
      longitude: 115.0835,
      phone: "081234567890",
      serviceRadiusKm: 10,
      status: "active",
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Rumah",
      recipientName: "Budi Santoso",
      phone: "082222222222",
      address: "Jl. Contoh No. 123, Binuang",
      latitude: -3.1700,
      longitude: 115.0900,
      notes: "Pagar hijau, rumah second floor",
      isDefault: true,
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Kantor",
      recipientName: "Budi Santoso",
      phone: "082222222222",
      address: "Jl. Pasar Binuang No. 45",
      latitude: -3.1580,
      longitude: 115.0780,
      isDefault: false,
    },
  });

  const services = [
    {
      name: "Cuci + Setrika",
      description: "Cuci bersih dan setrika rapi, siap pakai",
      price: 8000,
      pricingType: "per_kg",
      estimatedDuration: 48,
    },
    {
      name: "Cuci Saja",
      description: "Cuci bersih tanpa setrika",
      price: 5000,
      pricingType: "per_kg",
      estimatedDuration: 24,
    },
    {
      name: "Setrika",
      description: "Setrika rapi untuk pakaian yang sudah dicuci",
      price: 5000,
      pricingType: "per_kg",
      estimatedDuration: 12,
    },
    {
      name: "Express",
      description: "Cuci + setrika kilat, selesai dalam 24 jam",
      price: 12000,
      pricingType: "per_kg",
      estimatedDuration: 24,
    },
    {
      name: "Laundry Sepatu",
      description: "Deep clean & kering",
      price: 35000,
      pricingType: "per_item",
      estimatedDuration: 48,
    },
    {
      name: "Laundry Tas",
      description: "Cuci luar & dalam",
      price: 40000,
      pricingType: "per_item",
      estimatedDuration: 48,
    },
    {
      name: "Laundry Selimut",
      description: "Cuci & kering sempurna",
      price: 30000,
      pricingType: "per_item",
      estimatedDuration: 48,
    },
    {
      name: "Laundry Boneka",
      description: "Cuci lembut & higienis",
      price: 25000,
      pricingType: "per_item",
      estimatedDuration: 48,
    },
  ];

  for (const s of services) {
    await prisma.service.create({ data: s });
  }

  await prisma.setting.createMany({
    data: [
      { key: "base_fee", value: "5000" },
      { key: "price_per_km", value: "2000" },
      { key: "maximum_distance", value: "10" },
      { key: "app_name", value: "Laundry On-Demand" },
      { key: "require_additional_payment", value: "true" },
    ],
  });

  const now = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 3);

  await prisma.promo.create({
    data: {
      code: "DISKON20",
      name: "Diskon 20%",
      type: "percentage",
      value: 20,
      minimumOrder: 50000,
      maximumDiscount: 20000,
      startDate: now,
      endDate: end,
      usageLimit: 100,
      status: "active",
    },
  });

  await prisma.promo.create({
    data: {
      code: "HEMAT5K",
      name: "Hemat 5 Ribu",
      type: "fixed",
      value: 5000,
      minimumOrder: 30000,
      startDate: now,
      endDate: end,
      usageLimit: 200,
      status: "active",
    },
  });

  console.log("Seed complete!");
  console.log("--- Demo Accounts ---");
  console.log("Admin:   081111111111 / password123");
  console.log("Customer: 082222222222 / password123");
  console.log("Courier: 083333333333 / password123");
  console.log(`Outlet: ${outlet.name}`);
  console.log(`Users: admin=${admin.id}, courier=${courier.id}, courier2=${courier2.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
