import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteShipmentsForJob(jobNumber: string) {
  try {
    // Find the job
    const job = await prisma.job.findFirst({
      where: { jobNumber },
      include: { shipments: { include: { items: true } } }
    });

    if (!job) {
      console.error(`Job ${jobNumber} not found`);
      return;
    }

    console.log(`Found job ${jobNumber} with ${job.shipments.length} shipments`);
    
    // Display current shipments before deletion
    console.log('\nCurrent shipments:');
    job.shipments.forEach(s => {
      const kitData = typeof s.kitData === 'string' ? JSON.parse(s.kitData) : s.kitData;
      console.log(`  - ${kitData.shipmentId} (ERP: ${s.erpShipmentId || 'none'})`);
    });

    console.log('\n⚠️  This will permanently delete all shipments for this job.');
    console.log('Are you sure? Type "yes" to continue: ');
    
    // For safety, require confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        // Delete all shipment items first (due to foreign key constraint)
        const itemsDeleted = await prisma.shipmentItem.deleteMany({
          where: { 
            shipment: { jobId: job.id }
          }
        });
        
        console.log(`Deleted ${itemsDeleted.count} shipment items`);

        // Delete all shipments
        const shipmentsDeleted = await prisma.shipment.deleteMany({
          where: { jobId: job.id }
        });

        console.log(`✅ Deleted ${shipmentsDeleted.count} shipments`);
        
        // Reset job status
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'uploaded' }
        });
        
        console.log('✅ Job status reset to "uploaded"');
        console.log('\nYou can now re-upload the file to create new shipments with the updated grouping logic.');
      } else {
        console.log('Operation cancelled');
      }
      
      readline.close();
      await prisma.$disconnect();
    });

  } catch (error) {
    console.error('Error deleting shipments:', error);
    await prisma.$disconnect();
  }
}

// Get job number from command line argument
const jobNumber = process.argv[2];

if (!jobNumber) {
  console.error('Please provide a job number as argument');
  console.error('Usage: npx ts-node scripts/delete-job-shipments.ts <job-number>');
  process.exit(1);
}

deleteShipmentsForJob(jobNumber);