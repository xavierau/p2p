"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../src/prisma"));
const pubsub_1 = __importDefault(require("../src/services/pubsub"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting verification...');
        // Subscribe to events
        pubsub_1.default.subscribe('User.create.before', (data) => {
            console.log('EVENT: User.create.before', JSON.stringify(data, null, 2));
        });
        pubsub_1.default.subscribe('User.create.after', (data) => {
            console.log('EVENT: User.create.after', JSON.stringify(data, null, 2));
        });
        // Subscribe to delete events
        pubsub_1.default.subscribe('User.delete.before', (data) => {
            console.log('EVENT: User.delete.before', JSON.stringify(data, null, 2));
        });
        pubsub_1.default.subscribe('User.delete.after', (data) => {
            console.log('EVENT: User.delete.after', JSON.stringify(data, null, 2));
        });
        // Create a user to trigger events
        const email = `test-${Date.now()}@example.com`;
        console.log(`Creating user with email: ${email}`);
        try {
            const user = yield prisma_1.default.user.create({
                data: {
                    email: email,
                    password: 'password123',
                    name: 'Test User',
                },
            });
            console.log('User created:', user.id);
            // Delete the user to trigger delete events
            console.log(`Deleting user with id: ${user.id}`);
            yield prisma_1.default.user.delete({
                where: { id: user.id },
            });
            console.log('User deleted');
        }
        catch (error) {
            console.error('Error during verification:', error);
        }
        finally {
            yield prisma_1.default.$disconnect();
        }
    });
}
main();
