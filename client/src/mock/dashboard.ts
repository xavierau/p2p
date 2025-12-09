
export const invoiceAmountTrend = {
    weekly: [
        { name: 'Week 1', amount: 4000 },
        { name: 'Week 2', amount: 3000 },
        { name: 'Week 3', amount: 2000 },
        { name: 'Week 4', amount: 2780 },
    ],
    monthly: [
        { name: 'Jan', amount: 14000 },
        { name: 'Feb', amount: 13000 },
        { name: 'Mar', amount: 12000 },
        { name: 'Apr', amount: 12780 },
    ],
    quarterly: [
        { name: 'Q1', amount: 40000 },
        { name: 'Q2', amount: 30000 },
        { name: 'Q3', amount: 20000 },
        { name: 'Q4', amount: 27800 },
    ],
};

export const vendorShare = [
    { name: 'Vendor A', value: 400 },
    { name: 'Vendor B', value: 300 },
    { name: 'Vendor C', value: 300 },
    { name: 'Vendor D', value: 200 },
];

export const itemShare = [
    { name: 'Item A', value: 2400 },
    { name: 'Item B', value: 1398 },
    { name: 'Item C', value: 9800 },
    { name: 'Item D', value: 3908 },
    { name: 'Item E', value: 4800 },
    { name: 'Item F', value: 3800 },
    { name: 'Item G', value: 4300 },
];

export const priceChanges = [
    {
        name: 'Item A',
        vendor: 'Vendor A',
        oldPrice: 100,
        newPrice: 110,
        change: 10,
        percentageChange: 0.1,
        date: '2024-05-01',
    },
    {
        name: 'Item B',
        vendor: 'Vendor B',
        oldPrice: 50,
        newPrice: 45,
        change: -5,
        percentageChange: -0.1,
        date: '2024-05-02',
    },
    {
        name: 'Item C',
        vendor: 'Vendor A',
        oldPrice: 200,
        newPrice: 240,
        change: 40,
        percentageChange: 0.2,
        date: '2024-05-03',
    },
    {
        name: 'Item D',
        vendor: 'Vendor C',
        oldPrice: 80,
        newPrice: 81.6,
        change: 1.6,
        percentageChange: 0.02,
        date: '2024-05-04',
    },
];
