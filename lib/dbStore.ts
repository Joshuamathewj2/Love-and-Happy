import {
  Product,
  Category,
  Customer,
  OrderRow,
  OrderItemRow,
  OrderWithRelations,
  CartItem,
  Expense,
  PaymentMode,
  AdvanceOrderRow,
  AdvanceOrderItemRow,
  AdvanceOrderStatus,
  AdvanceOrderWithRelations,
} from './types';
import { LOVE_AND_HAPPY_CATEGORIES, LOVE_AND_HAPPY_PRODUCTS } from './catalogData';
import {
  supabaseFetchCategories,
  supabaseAddCategory,
  supabaseUpdateCategory,
  supabaseDeleteCategory,
  supabaseFetchProducts,
  supabaseAddProduct,
  supabaseUpdateProduct,
  supabaseDeleteProduct,
  supabaseSeedCatalog,
  supabaseUpsertCustomer,
  supabaseSubmitOrder,
  supabaseOrderIdExists,
  supabaseListOrdersWithRelations,
  supabaseGetOrderWithRelations,
  supabaseDeleteOrder,
  supabaseListExpenses,
  supabaseAddExpense,
  supabaseUpdateExpense,
  supabaseDeleteExpense,
  supabaseListAdvanceOrders,
  supabaseGetAdvanceOrder,
  supabaseAdvanceOrderIdExists,
  supabaseCreateAdvanceOrder,
  supabaseUpdateAdvanceOrderStatus,
  supabaseCancelAdvanceOrder,
  supabaseDeleteAdvanceOrder,
  supabaseFinalizeAdvanceOrder,
} from './supabaseActions';

export const dbStore = {
  // SEED CATALOG
  async seedDefaultCatalog(): Promise<{ categoriesCount: number; productsCount: number }> {
    return await supabaseSeedCatalog();
  },

  // CATEGORIES
  async listCategories(): Promise<Category[]> {
    return await supabaseFetchCategories();
  },

  async addCategory(name: string): Promise<Category> {
    return await supabaseAddCategory(name);
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    return await supabaseUpdateCategory(id, name);
  },

  async deleteCategory(id: string): Promise<void> {
    return await supabaseDeleteCategory(id);
  },

  // PRODUCTS
  async listProducts(): Promise<Product[]> {
    return await supabaseFetchProducts();
  },

  async getProduct(id: string): Promise<Product | null> {
    const products = await supabaseFetchProducts();
    return products.find((p) => p.id === id) || null;
  },

  async addProduct(input: {
    name: string;
    description: string | null;
    category: string;
    gst_rate: number;
    hsn_code: string | null;
    selling_price: number;
  }): Promise<Product> {
    const created = await supabaseAddProduct({
      id: `prod-${Date.now()}`,
      name: input.name,
      description: input.description,
      category: input.category,
      gst_rate: input.gst_rate,
      hsn_code: input.hsn_code,
      selling_price: input.selling_price,
      price: input.selling_price,
    });
    if (!created) {
      throw new Error('Failed to create product in database');
    }
    return created;
  },

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    return await supabaseUpdateProduct(id, patch);
  },

  async deleteProduct(id: string): Promise<void> {
    return await supabaseDeleteProduct(id);
  },

  // CUSTOMERS
  async upsertCustomer(name: string, phone: string, address?: string | null): Promise<Customer> {
    return await supabaseUpsertCustomer(name, phone, address);
  },

  // ORDERS
  async orderIdExists(id: string): Promise<boolean> {
    return await supabaseOrderIdExists(id);
  },

  async listOrdersWithRelations(): Promise<OrderWithRelations[]> {
    return await supabaseListOrdersWithRelations();
  },

  async getOrderWithRelations(id: string): Promise<OrderWithRelations | null> {
    return await supabaseGetOrderWithRelations(id);
  },

  async deleteOrder(id: string): Promise<void> {
    return await supabaseDeleteOrder(id);
  },

  // EXPENSES
  async listExpenses(): Promise<Expense[]> {
    return await supabaseListExpenses();
  },

  async addExpense(input: {
    title: string;
    category: string;
    amount: number;
    payment_mode: string;
    notes: string | null;
    expense_date: string;
  }): Promise<Expense> {
    return await supabaseAddExpense(input);
  },

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
    return await supabaseUpdateExpense(id, patch);
  },

  async deleteExpense(id: string): Promise<void> {
    return await supabaseDeleteExpense(id);
  },

  // ORDER SUBMISSION
  async submitOrder(payload: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    source: 'ONLINE' | 'OFFLINE';
    isGst: boolean;
    billDate: string;
    items: CartItem[];
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    gstPercentage: number;
    gstAmount: number;
    deliveryFee: number;
    grandTotal: number;
    cashReceived: number;
    splitCash?: number;
    splitGpay?: number;
    paymentMode: PaymentMode;
  }): Promise<{ orderId: string }> {
    return await supabaseSubmitOrder(payload);
  },

  // ADVANCE ORDERS
  async listAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
    return await supabaseListAdvanceOrders();
  },

  async getAdvanceOrder(id: string): Promise<AdvanceOrderWithRelations | null> {
    return await supabaseGetAdvanceOrder(id);
  },

  async advanceOrderIdExists(id: string): Promise<boolean> {
    return await supabaseAdvanceOrderIdExists(id);
  },

  async createAdvanceOrder(payload: {
    advanceOrderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    subtotal: number;
    totalAmount: number;
    depositAmount: number;
    depositPaymentMode: PaymentMode;
    deliveryDate: string | null;
    notes: string | null;
    items: {
      product_id: string | null;
      snapshot_name: string;
      snapshot_desc: string | null;
      snapshot_price: number;
      quantity: number;
    }[];
    isGst?: boolean;
    gstPercentage?: number;
    gstAmount?: number;
    taxMode?: 'exclusive' | 'inclusive';
    discountType?: 'PERCENT' | 'FIXED';
    discountValue?: number;
    discountAmount?: number;
    deliveryFee?: number;
  }): Promise<{ advanceOrderId: string }> {
    return await supabaseCreateAdvanceOrder(payload);
  },

  async updateAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
    return await supabaseUpdateAdvanceOrderStatus(id, status);
  },

  async cancelAdvanceOrder(id: string): Promise<void> {
    return await supabaseCancelAdvanceOrder(id);
  },

  async deleteAdvanceOrder(id: string): Promise<void> {
    return await supabaseDeleteAdvanceOrder(id);
  },

  async finalizeAdvanceOrder(payload: {
    advanceOrderId: string;
    invoiceId: string;
    isGst: boolean;
    gstPercentage: number;
    discountType: 'PERCENT' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    deliveryFee: number;
    paymentMode: PaymentMode;
    billDate: string;
    taxMode?: 'exclusive' | 'inclusive';
  }): Promise<{ orderId: string }> {
    return await supabaseFinalizeAdvanceOrder(payload);
  },
};
