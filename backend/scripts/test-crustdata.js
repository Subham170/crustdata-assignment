import 'dotenv/config';
import { resolveAndEnrichEmployer } from '../src/services/growthAnalysisService.js';

const companies = process.argv.slice(2).length ? process.argv.slice(2) : ['Razorpay', 'Google'];

for (const company of companies) {
  console.log(`\n--- ${company} ---`);
  const result = await resolveAndEnrichEmployer(company);

  if (result.status === 'resolved') {
    const { record, source } = result;
    console.log(`OK (${source})`);
    console.log({
      companyName: record.companyName,
      crustdataCompanyId: record.crustdataCompanyId,
      employeeGrowth6m: record.employeeGrowth6m,
      employeeGrowth12m: record.employeeGrowth12m,
      headcountTotal: record.headcountTotal,
    });
  } else {
    console.log('FAILED:', result.error);
  }
}
