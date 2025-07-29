import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding customers...');

  // Create customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { customerCode: 'INQUIRED' },
      update: {},
      create: {
        customerCode: 'INQUIRED',
        displayName: 'InquirED',
        defaultShipVia: 1, // UPS Ground
        metadata: {
          erpEnabled: true,
          erpSystem: 'PACE',
        },
      },
    }),
    prisma.customer.upsert({
      where: { customerCode: 'GEORGIA_BAPTIST' },
      update: {},
      create: {
        customerCode: 'GEORGIA_BAPTIST',
        displayName: 'Georgia Baptist',
        defaultShipVia: 1,
        metadata: {
          erpEnabled: false,
        },
      },
    }),
    prisma.customer.upsert({
      where: { customerCode: 'HH_GLOBAL' },
      update: {},
      create: {
        customerCode: 'HH_GLOBAL',
        displayName: 'HH Global',
        defaultShipVia: 1,
        metadata: {
          erpEnabled: false,
        },
      },
    }),
  ]);

  console.log(`Seeded ${customers.length} customers`);
  
  customers.forEach((customer) => {
    console.log(`- ${customer.displayName} (${customer.customerCode})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });