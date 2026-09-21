import { sql } from '@vercel/postgres';

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query || {};
    const { method } = req;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid or missing expense ID' });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const { title, amount, category, date, invoice_url, notes } = req.body || {};
      
      await sql`
        UPDATE expenses
        SET 
          title = COALESCE(${title}, title),
          amount = COALESCE(${amount}, amount),
          category = COALESCE(${category}, category),
          date = COALESCE(${date}, date),
          invoice_url = COALESCE(${invoice_url}, invoice_url),
          notes = COALESCE(${notes}, notes)
        WHERE id = ${id};
      `;

      return res.status(200).json({ success: true, message: `Expense ${id} updated successfully` });
    }

    if (method === 'DELETE') {
      await sql`DELETE FROM expenses WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: `Expense ${id} deleted successfully` });
    }

    res.setHeader('Allow', ['PUT', 'PATCH', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (error: any) {
    console.error(`API Error in /api/expenses/[id]:`, error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
