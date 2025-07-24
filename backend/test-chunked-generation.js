const axios = require('axios');

// Test data - minimal kit structure
const testKits = [
  {
    id: 'test-001',
    recipient: {
      name: 'Test User 1',
      company: 'Test Company 1',
      email: 'test1@example.com',
      phone: '555-1234',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'USA'
      }
    },
    items: [
      {
        id: 'item1',
        sku: 'TEST-SKU-001',
        name: 'Test Item 1',
        description: 'Test Description 1',
        quantity: 2
      }
    ],
    jobNumber: 'JOB-001',
    metadata: {
      customFields: {
        fileType: 'pm'
      },
      specialInstructions: 'Test instructions'
    }
  },
  {
    id: 'test-002',
    recipient: {
      name: 'Test User 2',
      company: 'Test Company 2',
      email: 'test2@example.com',
      phone: '555-5678',
      address: {
        street: '456 Test Ave',
        city: 'Test Town',
        state: 'TS',
        zipCode: '67890',
        country: 'USA'
      }
    },
    items: [
      {
        id: 'item2',
        sku: 'TEST-SKU-002',
        name: 'Test Item 2',
        description: 'Test Description 2',
        quantity: 1
      }
    ],
    jobNumber: 'JOB-002',
    metadata: {
      customFields: {
        fileType: 'te'
      },
      specialInstructions: 'Another test'
    }
  }
];

async function testChunkedGeneration() {
  try {
    console.log('Testing chunked PDF generation...');
    
    const response = await axios.post('http://localhost:3001/customers/GEORGIA_BAPTIST/generate-pdfs-chunked', {
      kits: testKits,
      chunkSize: 2
    });

    console.log('Success:', response.data);
    console.log('Output directory:', response.data.data.outputDirectory);
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

// Run the test
testChunkedGeneration();