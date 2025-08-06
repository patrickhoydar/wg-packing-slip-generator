import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetErpDataForJob(jobNumber: string) {
  try {
    // Find the job
    const job = await prisma.job.findFirst({
      where: { jobNumber },
      include: { shipments: true }
    });

    if (!job) {
      console.error(`Job ${jobNumber} not found`);
      return;
    }

    console.log(`Found job ${jobNumber} with ${job.shipments.length} shipments`);
    console.log('Resetting ERP data...');

    // Reset ERP data for all shipments in this job
    const result = await prisma.shipment.updateMany({
      where: { jobId: job.id },
      data: {
        erpShipmentId: null,
        erpSystem: null,
        erpResponse: undefined,  // Use undefined for JSON fields in Prisma
        status: 'pending'
      }
    });

    console.log(`✅ Reset ERP data for ${result.count} shipments`);
    
    // Also update job status back to uploaded if needed
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'uploaded' }
    });
    
    console.log('✅ Job status reset to "uploaded"');

  } catch (error) {
    console.error('Error resetting ERP data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get job number from command line argument
const jobNumber = process.argv[2];

if (!jobNumber) {
  console.error('Please provide a job number as argument');
  console.error('Usage: npx ts-node scripts/reset-erp-data.ts <job-number>');
  process.exit(1);
}

resetErpDataForJob(jobNumber);