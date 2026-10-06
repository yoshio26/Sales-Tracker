export type GuideSection = {
  title: string
  whatItIsFor: string
  howToUse: string[]
  tips: string[]
}

export const guideContent = {
  welcome: {
    eyebrow: 'SALES V1 GUIDE',
    title: 'A quick guide to Sales V1',
    description: 'Use this guide to move from adding stock to reviewing your sales history with confidence.',
  },
  quickStart: {
    title: 'Quick start',
    steps: [
      'Open Stocks and use Add stock to create your products, prices, and starting quantities.',
      'Open Bought to record a purchase from available stock.',
      'Review Dashboard for earnings, profit, available stock, and sold totals.',
      'Open Reports, choose a month, and use Export CSV to download your report files.',
      'Open Purchase History to search and review purchase records newest first.',
    ],
  },
  sections: [
    {
      title: 'Dashboard',
      whatItIsFor: 'See your earnings overview, profit, available stock, sold totals, and expense charts in one place.',
      howToUse: [
        'Read the summary cards for Total Earnings, Profit, Available stock, and Total sold.',
        'Use Search Product in Available stock to find a specific item.',
        'Use Edit or Delete on a stock row when you need to manage that item.',
        'Use the page controls and Rows per page selector to browse the stock table.',
      ],
      tips: ['If a chart has no data yet, add an initial stock cost or record activity from Stocks and Bought.'],
    },
    {
      title: 'Reports',
      whatItIsFor: 'Review spending charts and download monthly CSV files for purchase costs and current stock performance.',
      howToUse: [
        'Open Dashboard and choose the Reports tab.',
        'Choose the calendar month you want to report on from Report month.',
        'Select Export CSV to download the purchase report and stock report.',
        'Open the downloaded files in a spreadsheet application to filter, sort, or share them.',
      ],
      tips: ['The export control follows your selected Color Theme and Dark or Light mode, and adapts to smaller screens.'],
    },
    {
      title: 'Bought',
      whatItIsFor: 'Record purchases by reducing the available quantity of an existing stock item.',
      howToUse: [
        'Choose a product from the stock picker.',
        'Enter the quantity to buy and submit with Bought.',
        'If there is not enough stock, choose Okay or use Review stock from the warning dialog.',
        'Search Bought history with Search Product and use the page controls to browse records.',
      ],
      tips: ['Bought records include the product name, category, date, quantity, and total cost captured at purchase time.'],
    },
    {
      title: 'Stocks',
      whatItIsFor: 'Create, edit, replenish, and review the products currently available in your catalog.',
      howToUse: [
        'Use Add stock to enter a Stock name, Category, Unit price, and Initial quantity.',
        'Choose Yes or No for Deduct from Total Profit? before saving a new stock.',
        'Use Add stock in the Stocks area to replenish an existing item when needed.',
        'Search Product to find an item, then use Edit or Delete for that row.',
      ],
      tips: ['Use Multiple in the add-stock dialog to add several stock names, one per line.'],
    },
    {
      title: 'Purchase History',
      whatItIsFor: 'Review purchase records in newest-first order and remove an individual history entry when necessary.',
      howToUse: [
        'Use Search Product to filter the history list.',
        'Review the product, category, quantity, purchase date, and total cost for each record.',
        'Choose Delete on a record and confirm the deletion when prompted.',
        'Use Previous and Next to move between pages.',
      ],
      tips: ['Purchase history keeps the product and category labels captured when the purchase was recorded.'],
    },
    {
      title: 'Settings',
      whatItIsFor: 'Recover archived products, permanently remove retained records, and manage bulk product deletion.',
      howToUse: [
        'Use Archive to view products removed from active stocks.',
        'Choose Restore to return a product and its retained history to active stocks.',
        'Choose Delete permanently only when the product and history cannot be recovered.',
        'Open Settings to access the Delete all products action.',
      ],
      tips: ['Archived and bulk-deleted records remain available for recovery only during the retention period.'],
    },
    {
      title: 'Color Theme',
      whatItIsFor: 'Change the accent color used by the app without changing the existing light or dark mode.',
      howToUse: [
        'Choose Color Theme beside the other Settings tabs.',
        'Click a preset swatch such as Pink, Blue, Green, Purple, or Orange.',
        'Use the custom color picker to choose your own accent color.',
        'Use the existing Dark or Light button in the header to change display mode independently.',
      ],
      tips: ['Your selected color is saved in this browser and works in both light and dark mode.'],
    },
  ] satisfies GuideSection[],
  warning: {
    title: 'Before you delete all products',
    text: 'Delete all products removes active products, stock records, purchase history, and expenses. Deleted data is recoverable for 10 days, then automatically deleted.',
  },
  faq: [
    { question: 'Can I undo deleting one stock?', answer: 'Yes. Open Settings, find the product under Archive, and choose Restore during the recovery period.' },
    { question: 'Does Color Theme change Dark or Light mode?', answer: 'No. Color Theme changes accent colors only. The existing Dark or Light button controls display mode separately.' },
    { question: 'What does Export CSV download?', answer: 'For the selected month, it downloads one purchase report with Stock Name, Date Bought, and Cost, plus one stock report with Stock Name, Remaining Stocks, Updated Price, and Sold.' },
    { question: 'Why can’t I record a purchase?', answer: 'The selected product may not have enough available stock. Use Review stock in the warning dialog to check its quantity.' },
  ],
  personalMessage: 'Add your own welcome note here — for example, a reminder about your store’s daily stock routine.',
} as const
