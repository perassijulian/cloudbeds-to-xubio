import assert from 'assert';
import { mapToXubioPayload } from '../lib/mapping.js';

const sample = { transactionId: 'tx1', transactionDateTime: '2025-09-24T14:01:17', amount: 100, propertyId: '123' };
const mapped = mapToXubioPayload(sample, null);
assert.equal(mapped.total, 100);
console.log('mapping test ok');