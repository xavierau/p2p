import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Create Users
    const password = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: { role: 'ADMIN' },
        create: {
            email: 'admin@example.com',
            name: 'Admin User',
            password,
            role: 'ADMIN',
        },
    });

    const user = await prisma.user.upsert({
        where: { email: 'user@example.com' },
        update: { role: 'MANAGER' },
        create: {
            email: 'user@example.com',
            name: 'Regular User',
            password,
            role: 'MANAGER',
        },
    });

    console.log({ admin, user });

    // Create Vendors
    const vendor1 = await prisma.vendor.create({
        data: {
            name: 'Tech Supplies Inc.',
            contact: 'contact@techsupplies.com',
        },
    });

    const vendor2 = await prisma.vendor.create({
        data: {
            name: 'Office Depot',
            contact: 'sales@officedepot.com',
        },
    });

    console.log({ vendor1, vendor2 });

    // Create Items
    const item1 = await prisma.item.create({
        data: {
            name: 'Laptop',
            price: 1200.00,
            vendorId: vendor1.id,
        },
    });

    const item2 = await prisma.item.create({
        data: {
            name: 'Mouse',
            price: 25.50,
            vendorId: vendor1.id,
        },
    });

    const item3 = await prisma.item.create({
        data: {
            name: 'Desk Chair',
            price: 150.00,
            vendorId: vendor2.id,
        },
    });

    console.log({ item1, item2, item3 });

    // Create Invoices
    const invoice1 = await prisma.invoice.create({
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
    });

    const invoice2 = await prisma.invoice.create({
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
    });

    console.log({ invoice1, invoice2 });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
