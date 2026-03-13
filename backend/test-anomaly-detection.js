import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5002';
let authToken = '';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Helper function to login and get token
async function login() {
    console.log(`${colors.cyan}🔐 Logging in...${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'manufacturer@example.com',
                password: 'password123'
            })
        });

        const data = await response.json();
        if (data.token) {
            authToken = data.token;
            console.log(`${colors.green}✅ Login successful${colors.reset}\n`);
            return true;
        }
    } catch (error) {
        console.error(`${colors.red}❌ Login failed:${colors.reset}`, error.message);
    }
    return false;
}

// Test Case 1: Normal Manufacturing Entry (Should NOT trigger anomaly)
async function testNormalManufacturing() {
    console.log(`${colors.blue}📦 Test Case 1: Normal Manufacturing Entry${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/manufacturing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productName: 'Normal Product A',
                quantity: 100,
                pricePerUnit: 50,
                productionDate: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                batchNumber: `BATCH-${Date.now()}`,
                rawMaterialId: '507f1f77bcf86cd799439011'
            })
        });

        const data = await response.json();
        console.log(`${colors.green}✅ Normal entry created (Expected: No anomaly)${colors.reset}`);
        console.log(`   Product: ${data.productName}, Quantity: ${data.quantity}\n`);
    } catch (error) {
        console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    }
}

// Test Case 2: Extremely High Quantity (Should trigger CRITICAL anomaly)
async function testHighQuantityAnomaly() {
    console.log(`${colors.yellow}⚠️  Test Case 2: Extremely High Quantity Anomaly${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/manufacturing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productName: 'Suspicious High Quantity Product',
                quantity: 50000, // Extremely high quantity
                pricePerUnit: 45,
                productionDate: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                batchNumber: `BATCH-${Date.now()}`,
                rawMaterialId: '507f1f77bcf86cd799439011'
            })
        });

        const data = await response.json();
        console.log(`${colors.red}🚨 High quantity entry created (Expected: CRITICAL anomaly)${colors.reset}`);
        console.log(`   Product: ${data.productName}, Quantity: ${data.quantity}\n`);
    } catch (error) {
        console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    }
}

// Test Case 3: Unusual Price (Should trigger HIGH anomaly)
async function testPriceAnomaly() {
    console.log(`${colors.yellow}⚠️  Test Case 3: Unusual Price Anomaly${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/manufacturing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productName: 'Overpriced Product',
                quantity: 150,
                pricePerUnit: 15000, // Extremely high price
                productionDate: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                batchNumber: `BATCH-${Date.now()}`,
                rawMaterialId: '507f1f77bcf86cd799439011'
            })
        });

        const data = await response.json();
        console.log(`${colors.red}🚨 High price entry created (Expected: HIGH/CRITICAL anomaly)${colors.reset}`);
        console.log(`   Product: ${data.productName}, Price: $${data.pricePerUnit}\n`);
    } catch (error) {
        console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    }
}

// Test Case 4: Combined Anomalies (Should trigger CRITICAL anomaly)
async function testCombinedAnomaly() {
    console.log(`${colors.yellow}⚠️  Test Case 4: Combined Anomalies (Quantity + Price)${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/manufacturing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productName: 'Highly Suspicious Product',
                quantity: 25000, // High quantity
                pricePerUnit: 12000, // High price
                productionDate: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                batchNumber: `BATCH-${Date.now()}`,
                rawMaterialId: '507f1f77bcf86cd799439011'
            })
        });

        const data = await response.json();
        console.log(`${colors.red}🚨🚨 Combined anomaly entry created (Expected: CRITICAL anomaly)${colors.reset}`);
        console.log(`   Product: ${data.productName}, Quantity: ${data.quantity}, Price: $${data.pricePerUnit}\n`);
    } catch (error) {
        console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    }
}

// Test Case 5: Multiple Normal Entries (Should NOT trigger anomalies)
async function testMultipleNormalEntries() {
    console.log(`${colors.blue}📦 Test Case 5: Multiple Normal Entries${colors.reset}`);
    for (let i = 1; i <= 3; i++) {
        try {
            const response = await fetch(`${BASE_URL}/api/manufacturing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    productName: `Normal Product ${String.fromCharCode(65 + i)}`,
                    quantity: 80 + (i * 10),
                    pricePerUnit: 45 + (i * 5),
                    productionDate: new Date().toISOString(),
                    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    batchNumber: `BATCH-${Date.now()}-${i}`,
                    rawMaterialId: '507f1f77bcf86cd799439011'
                })
            });

            const data = await response.json();
            console.log(`${colors.green}✅ Normal entry ${i} created${colors.reset}`);
        } catch (error) {
            console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
        }
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('');
}

// Check anomaly alerts
async function checkAnomalyAlerts() {
    console.log(`${colors.magenta}📊 Fetching Anomaly Alerts...${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/anomalies?limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        console.log(`${colors.cyan}Total Alerts Found: ${data.total}${colors.reset}\n`);

        if (data.alerts && data.alerts.length > 0) {
            data.alerts.forEach((alert, index) => {
                const severityColor =
                    alert.severity === 'critical' ? colors.red :
                        alert.severity === 'high' ? colors.yellow :
                            alert.severity === 'medium' ? colors.blue : colors.green;

                console.log(`${severityColor}Alert ${index + 1}:${colors.reset}`);
                console.log(`  ID: ${alert.alertId}`);
                console.log(`  Severity: ${alert.severity.toUpperCase()}`);
                console.log(`  Type: ${alert.anomalyType}`);
                console.log(`  Score: ${(alert.anomalyScore * 100).toFixed(1)}%`);
                console.log(`  Description: ${alert.description}`);
                console.log(`  Status: ${alert.status}`);
                console.log(`  Time: ${new Date(alert.timestamp).toLocaleString()}`);
                console.log('');
            });
        } else {
            console.log(`${colors.yellow}No anomaly alerts found yet. They may take a moment to process.${colors.reset}\n`);
        }
    } catch (error) {
        console.error(`${colors.red}❌ Error fetching alerts:${colors.reset}`, error.message);
    }
}

// Get anomaly statistics
async function getAnomalyStats() {
    console.log(`${colors.magenta}📈 Fetching Anomaly Statistics...${colors.reset}`);
    try {
        const response = await fetch(`${BASE_URL}/api/anomalies/stats/summary?days=1`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        console.log(`${colors.cyan}Statistics (Last 24 hours):${colors.reset}`);
        console.log(`  Total Alerts: ${data.summary.total || 0}`);
        console.log(`  Critical: ${data.summary.critical || 0}`);
        console.log(`  High: ${data.summary.high || 0}`);
        console.log(`  Medium: ${data.summary.medium || 0}`);
        console.log(`  Low: ${data.summary.low || 0}`);
        console.log(`  New: ${data.summary.new || 0}`);
        console.log(`  Acknowledged: ${data.summary.acknowledged || 0}`);
        console.log(`  Resolved: ${data.summary.resolved || 0}`);
        console.log('');
    } catch (error) {
        console.error(`${colors.red}❌ Error fetching stats:${colors.reset}`, error.message);
    }
}

// Main test execution
async function runTests() {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}🤖 AI ANOMALY DETECTION TEST SUITE${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

    // Login first
    const loggedIn = await login();
    if (!loggedIn) {
        console.log(`${colors.red}Cannot proceed without authentication${colors.reset}`);
        return;
    }

    // Run test cases
    await testNormalManufacturing();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testHighQuantityAnomaly();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testPriceAnomaly();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testCombinedAnomaly();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testMultipleNormalEntries();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait a bit for anomaly detection to process
    console.log(`${colors.yellow}⏳ Waiting for anomaly detection to process...${colors.reset}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check results
    await checkAnomalyAlerts();
    await getAnomalyStats();

    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}✅ Test suite completed!${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    console.log(`${colors.yellow}💡 Next steps:${colors.reset}`);
    console.log(`   1. Open the Anomaly Alerts page in your browser`);
    console.log(`   2. Open the Anomaly Dashboard to see statistics`);
    console.log(`   3. Check for real-time WebSocket notifications\n`);
}

// Run the tests
runTests().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
});
