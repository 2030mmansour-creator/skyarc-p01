export const ExpensesApiService = {
  async getExpenses() {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (data.success && Array.isArray(data.expenses)) {
        return data.expenses;
      }
      return [];
    } catch (err) {
      console.error('Error fetching expenses from API:', err);
      return [];
    }
  },

  async addExpense(expenseData: {
    id?: string;
    title?: string;
    amount: number;
    category?: string;
    date?: string;
    invoice_url?: string;
    notes?: string;
    [key: string]: any;
  }) {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error adding expense via API:', err);
      return { success: false, error: err };
    }
  },

  async updateExpense(id: string, updates: { [key: string]: any }) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error updating expense via API:', err);
      return { success: false, error: err };
    }
  },

  async deleteExpense(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error deleting expense via API:', err);
      return { success: false, error: err };
    }
  }
};
