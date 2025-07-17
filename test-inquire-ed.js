const fs = require('fs');
const path = require('path');

// Simple test script to validate InquireEd strategy with actual sample data
async function testInquireEdStrategy() {
  console.log('Testing InquireEd Strategy with actual sample data...\n');
  
  // Test PM Orders file
  const pmFilePath = path.join(__dirname, 'docs/sample-data/Customers/InquireED/PM Orders_ Ready for Wallace (3).csv');
  const teFilePath = path.join(__dirname, 'docs/sample-data/Customers/InquireED/TE Orders_ Ready for Wallace (4).csv');
  
  try {
    // Read the PM file
    const pmData = fs.readFileSync(pmFilePath, 'utf8');
    const pmLines = pmData.split('\n');
    console.log('PM Orders File Analysis:');
    console.log(`- Total lines: ${pmLines.length}`);
    console.log(`- Header line: ${pmLines[0]}`);
    console.log(`- First data line: ${pmLines[1]}`);
    
    // Check for BOM
    const hasBOM = pmData.charCodeAt(0) === 0xFEFF;
    console.log(`- Has BOM: ${hasBOM}`);
    
    // Count columns
    const headers = pmLines[0].replace(/^\uFEFF/, '').split(',');
    console.log(`- Number of columns: ${headers.length}`);
    
    // Check for PM indicators
    const hasPMIndicators = headers.some(h => h.includes('Total Number of Boxes Ordered'));
    console.log(`- Has PM indicators: ${hasPMIndicators}`);
    
    // Check for SKU patterns
    const pmSkus = headers.filter(h => h.includes('IND-IJ-PM-'));
    console.log(`- PM SKUs found: ${pmSkus.length}`);
    
    console.log('\n---\n');
    
    // Read the TE file
    const teData = fs.readFileSync(teFilePath, 'utf8');
    const teLines = teData.split('\n');
    console.log('TE Orders File Analysis:');
    console.log(`- Total lines: ${teLines.length}`);
    console.log(`- Header line: ${teLines[0]}`);
    console.log(`- First data line: ${teLines[1]}`);
    
    // Check for BOM
    const teBOM = teData.charCodeAt(0) === 0xFEFF;
    console.log(`- Has BOM: ${teBOM}`);
    
    // Count columns
    const teHeaders = teLines[0].replace(/^\uFEFF/, '').split(',');
    console.log(`- Number of columns: ${teHeaders.length}`);
    
    // Check for TE indicators
    const hasTEIndicators = teHeaders.some(h => h.includes('Total Number of TEs Ordered'));
    console.log(`- Has TE indicators: ${hasTEIndicators}`);
    
    // Check for SKU patterns
    const teSkus = teHeaders.filter(h => h.includes('IND-IJ-TE-'));
    console.log(`- TE SKUs found: ${teSkus.length}`);
    
    console.log('\n---\n');
    
    // Test quantity parsing examples
    console.log('Sample quantity parsing tests:');
    
    // PM format examples
    const pmQuantities = ['2, K', '3, 1', '4, 5', '12, K'];
    console.log('PM quantities:');
    pmQuantities.forEach(q => {
      const match = q.match(/(\d+),\s*([KkGg\d]+)/);
      if (match) {
        console.log(`  "${q}" -> quantity: ${match[1]}, grade: ${match[2]}`);
      }
    });
    
    // TE format examples
    const teQuantities = ['30, No Sticker', '28, Needs Sticker: K', '26, Needs Sticker: 4'];
    console.log('TE quantities:');
    teQuantities.forEach(q => {
      const match = q.match(/(\d+),\s*(No Sticker|Needs Sticker(?::\s*([KkGg\d]+))?)/);
      if (match) {
        console.log(`  "${q}" -> quantity: ${match[1]}, sticker: ${match[2]}, grade: ${match[3] || 'none'}`);
      }
    });
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInquireEdStrategy();