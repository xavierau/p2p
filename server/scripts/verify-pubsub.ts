import prisma from '../src/prisma';
import pubSubService from '../src/services/pubsub';

async function main() {
    console.log('Starting verification...');

    // Subscribe to events
    pubSubService.subscribe('User.create.before', (data) => {
        console.log('EVENT: User.create.before', JSON.stringify(data, null, 2));
    });

    pubSubService.subscribe('User.create.after', (data) => {
        console.log('EVENT: User.create.after', JSON.stringify(data, null, 2));
    });

    // Subscribe to delete events
    pubSubService.subscribe('User.delete.before', (data) => {
        console.log('EVENT: User.delete.before', JSON.stringify(data, null, 2));
    });

    pubSubService.subscribe('User.delete.after', (data) => {
        console.log('EVENT: User.delete.after', JSON.stringify(data, null, 2));
    });

    // Create a user to trigger events
    const email = `test-${Date.now()}@example.com`;
    console.log(`Creating user with email: ${email}`);

    try {
        const user = await prisma.user.create({
            data: {
                email: email,
                password: 'password123',
                name: 'Test User',
            },
        });
        console.log('User created:', user.id);

        // Delete the user to trigger delete events
        console.log(`Deleting user with id: ${user.id}`);
        await prisma.user.delete({
            where: { id: user.id },
        });
        console.log('User deleted');

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
