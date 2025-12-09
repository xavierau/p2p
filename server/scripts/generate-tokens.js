"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
// Generate tokens for test users
const adminToken = jsonwebtoken_1.default.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '30d' });
const userToken = jsonwebtoken_1.default.sign({ userId: 2 }, JWT_SECRET, { expiresIn: '30d' });
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
