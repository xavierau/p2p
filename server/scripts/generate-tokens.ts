import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Generate tokens for test users
const adminToken = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '30d' });
const userToken = jwt.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '30d' });

console.log('\n=== API Test Tokens ===\n');
console.log('Admin User (admin@example.com):');
console.log(adminToken);
console.log('\n');
console.log('Regular User (user@example.com):');
console.log(userToken);
console.log('\n');
console.log('Usage in Postman/curl:');
console.log('Authorization: Bearer <token>');
console.log('\n');
