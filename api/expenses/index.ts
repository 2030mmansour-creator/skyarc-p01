import { sql } from '@vercel/postgres';

async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT,
        amount NUMERIC,
        category VARCHAR(255),
        date VARCHAR(50),
        invoice_url TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } catch (err) {
    console.error('Error creating expenses table:', err);
  }
}

export default async function handler(req: any, res: any) {
  try {
    await ensureTable();
    const { method } = req;

    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM expenses ORDER BY created_at DESC;`;
      return res.status(200).json({ success: true, expenses: rows });
    }

    if (method === 'POST') {
      const { id, title, amount, category, date, invoice_url, notes } = req.body || {};
      const expenseId = id || `exp_${Date.now()}`;
      
      await sql`
        INSERT INTO expenses (id, title, amount, category, date, invoice_url, notes)
        VALUES (${expenseId}, ${title || ''}, ${amount || 0}, ${category || 'عام'}, ${date || new Date().toISOString().slice(0, 10)}, ${invoice_url || null}, ${notes || null})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          invoice_url = EXCLUDED.invoice_url,
          notes = EXCLUDED.notes;
      `;

      return res.status(201).json({ success: true, id: expenseId, message: 'Expense created successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (error: any) {
    console.error('API Error in /api/expenses:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
