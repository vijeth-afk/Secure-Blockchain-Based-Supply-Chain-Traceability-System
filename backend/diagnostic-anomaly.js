/**
 * Standalone Anomaly Detection Diagnostic
 * Tests the anomaly detector logic without requiring full backend/database
 */

// Statistical helper functions
const calculateMean = (values) => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateStdDev = (values) => {
    if (values.length < 2) return 0;
    const mean = calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
};

const calculateZScore = (value, mean, stdDev) => {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
};

// Simplified Isolation Forest
class IsolationForest {
    constructor(contamination = 0.1) {
        this.contamination = contamination;
        this.baseline = { means: {}, stdDevs: {} };
    }

    fit(data) {
        const features = Object.keys(data[0] || {});
        features.forEach(feature => {
            const values = data.map(d => d[feature]).filter(v => typeof v === 'number');
            this.baseline.means[feature] = calculateMean(values);
            this.baseline.stdDevs[feature] = calculateStdDev(values);
        });
    }

    predict(sample) {
        let totalScore = 0;
        let featureCount = 0;

        Object.keys(sample).forEach(feature => {
            if (typeof sample[feature] === 'number' && this.baseline.means[feature] !== undefined) {
                const zScore = Math.abs(calculateZScore(
                    sample[feature],
                    this.baseline.means[feature],
                    this.baseline.stdDevs[feature]
                ));
                const featureScore = Math.min(zScore / 5, 1);
                totalScore += featureScore;
                featureCount++;
            }
        });

        return featureCount > 0 ? totalScore / featureCount : 0;
    }
}

// Test data generators
function generateNormalData() {
    return Array.from({ length: 50 }, (_, i) => ({
        quantity: 80 + Math.random() * 40,
        pricePerUnit: 40 + Math.random() * 20,
        timeSinceLastUpdate: 1 + Math.random() * 4
    }));
}

function generateTestCases() {
    return [
        {
            name: 'Normal Manufacturing Entry',
            data: { quantity: 100, pricePerUnit: 50, timeSinceLastUpdate: 2 },
            expectedAnomaly: false
        },
        {
            name: 'Extremely High Quantity',
            data: { quantity: 50000, pricePerUnit: 45, timeSinceLastUpdate: 2 },
            expectedAnomaly: true
        },
        {
            name: 'Unusual Price',
            data: { quantity: 150, pricePerUnit: 15000, timeSinceLastUpdate: 2 },
            expectedAnomaly: true
        },
        {
            name: 'Combined Anomalies',
            data: { quantity: 25000, pricePerUnit: 12000, timeSinceLastUpdate: 2 },
            expectedAnomaly: true
        },
        {
            name: 'Stale Data (Old Timestamp)',
            data: { quantity: 100, pricePerUnit: 50, timeSinceLastUpdate: 800 },
            expectedAnomaly: true
        },
        {
            name: 'Multiple Normal Entries',
            data: { quantity: 90, pricePerUnit: 55, timeSinceLastUpdate: 1.5 },
            expectedAnomaly: false
        }
    ];
}

// Color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Main diagnostic
async function runDiagnostic() {
    console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.cyan}🔍 ANOMALY DETECTION DIAGNOSTIC${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);

    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        anomaliesDetected: 0,
        testCases: []
    };

    try {
        // Initialize model
        console.log(`${colors.blue}📚 Training model with baseline data...${colors.reset}`);
        const model = new IsolationForest();
        const normalData = generateNormalData();
        model.fit(normalData);
        console.log(`${colors.green}✅ Model trained with ${normalData.length} normal samples${colors.reset}\n`);

        // Run test cases
        console.log(`${colors.blue}🧪 Running test cases...${colors.reset}\n`);
        const testCases = generateTestCases();

        for (const testCase of testCases) {
            results.total++;
            const anomalyScore = model.predict(testCase.data);
            const isAnomaly = anomalyScore > 0.5;
            const passed = isAnomaly === testCase.expectedAnomaly;

            if (passed) results.passed++;
            else results.failed++;

            if (isAnomaly) results.anomaliesDetected++;

            // Determine severity
            let severity = 'low';
            if (anomalyScore > 0.8) severity = 'critical';
            else if (anomalyScore > 0.6) severity = 'high';
            else if (anomalyScore > 0.4) severity = 'medium';

            const statusIcon = passed ? colors.green + '✅' : colors.red + '❌';
            const severityColor =
                severity === 'critical' ? colors.red :
                    severity === 'high' ? colors.yellow :
                        severity === 'medium' ? colors.blue : colors.green;

            console.log(`${statusIcon}${colors.reset} ${testCase.name}`);
            console.log(`   Score: ${(anomalyScore * 100).toFixed(1)}% | Severity: ${severityColor}${severity.toUpperCase()}${colors.reset} | Expected: ${testCase.expectedAnomaly ? 'ANOMALY' : 'NORMAL'}`);

            results.testCases.push({
                name: testCase.name,
                anomalyScore,
                severity,
                isAnomaly,
                passed,
                data: testCase.data
            });

            console.log('');
        }

        // Summary
        console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}`);
        console.log(`${colors.cyan}📊 DIAGNOSTIC SUMMARY${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);

        console.log(`Total Tests: ${results.total}`);
        console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
        console.log(`Anomalies Detected: ${results.anomaliesDetected}`);

        const passRate = ((results.passed / results.total) * 100).toFixed(1);
        const passRateColor = results.passed === results.total ? colors.green : colors.yellow;
        console.log(`${passRateColor}Pass Rate: ${passRate}%${colors.reset}\n`);

        // Severity breakdown
        const severityCount = {};
        results.testCases.forEach(tc => {
            severityCount[tc.severity] = (severityCount[tc.severity] || 0) + 1;
        });

        console.log(`${colors.magenta}Severity Breakdown:${colors.reset}`);
        console.log(`  Critical: ${severityCount.critical || 0}`);
        console.log(`  High: ${severityCount.high || 0}`);
        console.log(`  Medium: ${severityCount.medium || 0}`);
        console.log(`  Low: ${severityCount.low || 0}\n`);

        // Save results to file
        const fs = await import('fs').then(m => m.default);
        const resultsFile = './diagnostic-results.json';
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`${colors.green}✅ Results saved to ${resultsFile}${colors.reset}\n`);

        // Export for dashboard
        const dashboardData = {
            timestamp: new Date().toISOString(),
            diagnosticStatus: 'completed',
            passRate: parseFloat(passRate),
            totalTests: results.total,
            passed: results.passed,
            failed: results.failed,
            anomaliesDetected: results.anomaliesDetected,
            severityBreakdown: severityCount,
            testCases: results.testCases.map(tc => ({
                name: tc.name,
                score: parseFloat((tc.anomalyScore * 100).toFixed(1)),
                severity: tc.severity,
                isAnomaly: tc.isAnomaly,
                passed: tc.passed
            }))
        };

        fs.writeFileSync('./diagnostic-dashboard-data.json', JSON.stringify(dashboardData, null, 2));
        console.log(`${colors.green}✅ Dashboard data exported to diagnostic-dashboard-data.json${colors.reset}\n`);

        console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}`);
        console.log(`${colors.green}✅ DIAGNOSTIC COMPLETE${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);

        return dashboardData;

    } catch (error) {
        console.error(`${colors.red}❌ Diagnostic failed:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Run diagnostic
runDiagnostic().catch(err => {
    console.error(colors.red, 'Fatal error:', err, colors.reset);
    process.exit(1);
});
