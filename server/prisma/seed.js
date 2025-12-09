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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcryptjs_1 = __importDefault(require("bcryptjs"));
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var password, admin, user, vendor1, vendor2, item1, item2, item3, invoice1, invoice2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, bcryptjs_1.default.hash('password123', 10)];
                case 1:
                    password = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@example.com' },
                            update: { role: 'ADMIN' },
                            create: {
                                email: 'admin@example.com',
                                name: 'Admin User',
                                password: password,
                                role: 'ADMIN',
                            },
                        })];
                case 2:
                    admin = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'user@example.com' },
                            update: { role: 'MANAGER' },
                            create: {
                                email: 'user@example.com',
                                name: 'Regular User',
                                password: password,
                                role: 'MANAGER',
                            },
                        })];
                case 3:
                    user = _a.sent();
                    console.log({ admin: admin, user: user });
                    return [4 /*yield*/, prisma.vendor.create({
                            data: {
                                name: 'Tech Supplies Inc.',
                                contact: 'contact@techsupplies.com',
                            },
                        })];
                case 4:
                    vendor1 = _a.sent();
                    return [4 /*yield*/, prisma.vendor.create({
                            data: {
                                name: 'Office Depot',
                                contact: 'sales@officedepot.com',
                            },
                        })];
                case 5:
                    vendor2 = _a.sent();
                    console.log({ vendor1: vendor1, vendor2: vendor2 });
                    return [4 /*yield*/, prisma.item.create({
                            data: {
                                name: 'Laptop',
                                price: 1200.00,
                                vendorId: vendor1.id,
                            },
                        })];
                case 6:
                    item1 = _a.sent();
                    return [4 /*yield*/, prisma.item.create({
                            data: {
                                name: 'Mouse',
                                price: 25.50,
                                vendorId: vendor1.id,
                            },
                        })];
                case 7:
                    item2 = _a.sent();
                    return [4 /*yield*/, prisma.item.create({
                            data: {
                                name: 'Desk Chair',
                                price: 150.00,
                                vendorId: vendor2.id,
                            },
                        })];
                case 8:
                    item3 = _a.sent();
                    console.log({ item1: item1, item2: item2, item3: item3 });
                    return [4 /*yield*/, prisma.invoice.create({
                            data: {
                                userId: user.id,
                                status: 'PENDING',
                                totalAmount: 1225.50,
                                items: {
                                    create: [
                                        {
                                            itemId: item1.id,
                                            quantity: 1,
                                            price: item1.price,
                                        },
                                        {
                                            itemId: item2.id,
                                            quantity: 1,
                                            price: item2.price,
                                        },
                                    ],
                                },
                            },
                        })];
                case 9:
                    invoice1 = _a.sent();
                    return [4 /*yield*/, prisma.invoice.create({
                            data: {
                                userId: admin.id,
                                status: 'APPROVED',
                                totalAmount: 300.00,
                                items: {
                                    create: [
                                        {
                                            itemId: item3.id,
                                            quantity: 2,
                                            price: item3.price,
                                        },
                                    ],
                                },
                            },
                        })];
                case 10:
                    invoice2 = _a.sent();
                    console.log({ invoice1: invoice1, invoice2: invoice2 });
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); })
    .catch(function (e) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.error(e);
                return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                process.exit(1);
                return [2 /*return*/];
        }
    });
}); });
