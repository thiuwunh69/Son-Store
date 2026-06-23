export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  description: string;
  image: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
  note?: string;
}

export interface Order {
  id: string;
  customer: Customer;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  paymentMethod: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  createdAt: string;
  sheetsSynced?: boolean;
  sheetsError?: string;
  emailSent?: boolean;
  emailError?: string;
}

export interface AdminStatus {
  isConnected: boolean;
  expiresIn: number;
  email: string | null;
  name: string | null;
  config: {
    spreadsheetId: string;
    spreadsheetUrl: string;
    bankName: string;
    bankAccount: string;
    bankAccountName: string;
    emailHost?: string;
    emailPort?: number;
    emailUser?: string;
    emailPass?: string;
    emailSenderName?: string;
    smtpEnabled?: boolean;
  };
}
