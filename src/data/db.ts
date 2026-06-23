import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  note?: string;
}

export interface Order {
  id: string;
  customer: CustomerInfo;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  createdAt: string;
  sheetsSynced?: boolean;
  sheetsError?: string;
  emailSent?: boolean;
  emailError?: string;
}

export interface AdminToken {
  accessToken: string;
  expiresAt: number; // timestamp
  email?: string;
  name?: string;
}

export interface AdminConfig {
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
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ADMIN_TOKEN_FILE = path.join(DATA_DIR, 'admin_token.json');
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, 'admin_config.json');
const PRODUCTS_FILE = path.join(process.cwd(), 'src', 'data', 'products.json');

export function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(ADMIN_TOKEN_FILE)) {
    fs.writeFileSync(ADMIN_TOKEN_FILE, JSON.stringify(null, null, 2), 'utf-8');
  }
  if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
    const defaultConfigs: AdminConfig = {
      spreadsheetId: '',
      spreadsheetUrl: '',
      bankName: 'MB Bank', // Military Bank is standard in VN
      bankAccount: '19028468888',
      bankAccountName: 'NGUYEN HOANG SON',
      emailHost: 'smtp.gmail.com',
      emailPort: 465,
      emailUser: '',
      emailPass: '',
      emailSenderName: 'Son Store',
      smtpEnabled: false
    };
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(defaultConfigs, null, 2), 'utf-8');
  }
}

export function getProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading products file', error);
  }
  return [];
}

export function getOrders(): Order[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading orders file', error);
  }
  return [];
}

export function saveOrders(orders: Order[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving orders', error);
  }
}

export function addOrder(order: Order): Order {
  const orders = getOrders();
  orders.unshift(order); // Store most recent first
  saveOrders(orders);
  return order;
}

export function updateOrder(orderId: string, updates: Partial<Order>): Order | null {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates };
    saveOrders(orders);
    return orders[index];
  }
  return null;
}

export function getAdminToken(): AdminToken | null {
  try {
    if (fs.existsSync(ADMIN_TOKEN_FILE)) {
      const data = fs.readFileSync(ADMIN_TOKEN_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading admin token', error);
  }
  return null;
}

export function saveAdminToken(token: AdminToken | null) {
  try {
    fs.writeFileSync(ADMIN_TOKEN_FILE, JSON.stringify(token, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving admin token', error);
  }
}

export function getAdminConfig(): AdminConfig {
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      const data = fs.readFileSync(ADMIN_CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading admin config', error);
  }
  return {
    spreadsheetId: '',
    spreadsheetUrl: '',
    bankName: 'MB Bank',
    bankAccount: '19028468888',
    bankAccountName: 'NGUYEN HOANG SON',
    emailHost: 'smtp.gmail.com',
    emailPort: 465,
    emailUser: '',
    emailPass: '',
    emailSenderName: 'Son Store',
    smtpEnabled: false
  };
}

export function saveAdminConfig(config: AdminConfig) {
  try {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving admin config', error);
  }
}

// Write to Google Sheets API helper
export async function syncOrderToSheets(order: Order, token: string, spreadsheetId: string): Promise<boolean> {
  if (!spreadsheetId) return false;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:append?valueInputOption=USER_ENTERED`;
  
  const itemsStr = order.items.map(item => `${item.name} (x${item.quantity})`).join('\n');
  const dateFormatted = new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const totalFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total);

  const rowValues = [
    [
      order.id,
      order.customer.name,
      order.customer.phone,
      order.customer.email,
      order.customer.address,
      itemsStr,
      totalFormatted,
      order.status,
      dateFormatted,
      order.customer.note || ''
    ]
  ];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: rowValues
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Sheets append error:', errText);
      throw new Error(`Google Sheets API responded with status ${response.status}: ${errText}`);
    }

    return true;
  } catch (err: any) {
    console.error('Failed to sync to sheets:', err.message);
    throw err;
  }
}

// Auto-initialize sheets layout with headers
export async function initializeSheetHeaders(spreadsheetId: string, token: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1?valueInputOption=USER_ENTERED`;
  const headers = [
    [
      "Mã đơn hàng",
      "Khách hàng",
      "Số điện thoại",
      "Email",
      "Địa chỉ giao hàng",
      "Sản phẩm mua",
      "Tổng thanh toán",
      "Trạng thái",
      "Ngày đặt",
      "Ghi chú"
    ]
  ];

  try {
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: headers
      })
    });
  } catch (error) {
    console.error('Error writing sheet headers', error);
  }
}

// Create a new Spreadsheet for the Admin automatically
export async function createAutomaticSpreadsheet(token: string): Promise<{ id: string, url: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: "Son Store - Quản Lý Đơn Hàng"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Sheets creation status: ${response.status}`);
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Initialize the sheet high quality header row instantly
    await initializeSheetHeaders(spreadsheetId, token);

    return { id: spreadsheetId, url: spreadsheetUrl };
  } catch (error: any) {
    console.error('Failed to create automatic spreadsheet', error);
    throw error;
  }
}

// Send Gmail Confirmation API helper
export async function sendGmailConfirmation(order: Order, token: string): Promise<boolean> {
  const recipient = order.customer.email;
  if (!recipient) return false;

  const itemsListHtml = order.items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</td>
    </tr>
  `).join('');

  const totalStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total);

  const subject = `[Son Store] Xác nhận đơn hàng thành công #${order.id}`;
  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #111; font-weight: 500; font-size: 24px; letter-spacing: 1px;">SON STORE</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 13px; font-style: italic;">Elevate Your Digital Life</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #333;">Chào <strong>${order.customer.name}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #333;">Chúng tôi xin thông báo đơn hàng mã <strong>#${order.id}</strong> của bạn đã được xác nhận thanh toán thành công và đang chuẩn bị giao đến địa chỉ của bạn.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #111; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">THÔNG TIN ĐƠN HÀNG</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f1f1f1;">
              <th style="padding: 8px; text-align: left;">Sản phẩm</th>
              <th style="padding: 8px; text-align: center;">SL</th>
              <th style="padding: 8px; text-align: right;">Giá</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHtml}
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 15px; font-size: 16px; font-weight: bold; color: #111;">
          Tổng thanh toán: ${totalStr}
        </div>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
        <h4 style="margin-top:0; color:#d97706; font-size:14px; font-weight:bold;">📍 THÔNG TIN GIAO HÀNG</h4>
        <p style="margin: 4px 0;"><strong>Họ tên:</strong> ${order.customer.name}</p>
        <p style="margin: 4px 0;"><strong>Điện thoại:</strong> ${order.customer.phone}</p>
        <p style="margin: 4px 0;"><strong>Địa chỉ:</strong> ${order.customer.address}</p>
        ${order.customer.note ? `<p style="margin: 4px 0;"><strong>Ghi chú:</strong> ${order.customer.note}</p>` : ''}
      </div>

      <p style="font-size: 14px; color: #555; line-height: 1.6;">Đơn hàng sẽ được chuyển cho đơn vị vận chuyển sớm nhất. Nếu quý khách có bất kỳ yêu cầu hay thắc mắc nào khác, xin vui lòng phản hồi lại email này hoặc liên hệ hotline: <strong>090 123 4567</strong>.</p>
      
      <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 15px; text-align: center; font-size: 12px; color: #999;">
        <p style="margin: 0;">Son Store - Hệ thống phân phối sản phẩm công nghệ cao cấp</p>
        <p style="margin: 5px 0 0 0;">Cảm ơn bạn đã lựa chọn mua sắm cùng chúng tôi!</p>
      </div>
    </div>
  `;

  // Construct MIME email raw message
  const emailLines = [
    `To: ${recipient}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    "",
    htmlBody
  ];
  
  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const gmailUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  try {
    const response = await fetch(gmailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gmail send error:', errText);
      throw new Error(`Gmail API failure code ${response.status}: ${errText}`);
    }

    return true;
  } catch (error: any) {
    console.error('Failed to send email via Gmail:', error);
    throw error;
  }
}

// Send Real SMTP Confirmation via Nodemailer
export async function sendSmtpConfirmation(order: Order, config: AdminConfig): Promise<boolean> {
  if (!config.smtpEnabled || !config.emailUser || !config.emailPass) {
    throw new Error('SMTP chưa được cấu hình hoàn thiện hoặc chưa kích hoạt trong phần cài đặt.');
  }

  const transporter = nodemailer.createTransport({
    host: config.emailHost || 'smtp.gmail.com',
    port: Number(config.emailPort) || 465,
    secure: Number(config.emailPort) === 465, // True for 465, false for 587
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
    tls: {
      rejectUnauthorized: false // bypass certificate errors for compatibility
    }
  });

  const recipient = order.customer.email;
  if (!recipient) return false;

  const itemsListHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eeeff2; font-family: sans-serif; font-size: 13px; color: #374151;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eeeff2; font-family: monospace; font-size: 13px; color: #111827; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eeeff2; font-family: monospace; font-size: 13px; color: #111827; text-align: right; font-weight: 500;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</td>
    </tr>
  `).join('');

  const totalStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total);
  const subject = `[Son Store] Xác nhận đơn hàng thành công #${order.id}`;

  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
      <div style="text-align: center; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 25px;">
        <h1 style="margin: 0; color: #111827; font-weight: 700; font-size: 26px; tracking-wider: 2px; letter-spacing: 2px;">SON STORE</h1>
        <p style="margin: 6px 0 0 0; color: #D4AF37; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px;">ĐẲNG CẤP SỐ - TRẢI NGHIỆM THƯỢNG LƯU</p>
      </div>
      
      <p style="font-size: 15px; color: #111827; margin-bottom: 16px;">Kính chào Quý khách <strong>${order.customer.name}</strong>,</p>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 24px;">Chúng tôi hân hạnh thông báo đơn hàng mã <strong style="color: #111827; font-family: monospace;">#${order.id}</strong> thuộc hệ thống Son Store của Quý khách đã được xác thực chuyển khoản thành công và đang được đóng gói giao tới địa chỉ dưới đây.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #f3f4f6; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #111827; font-size: 13px; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; text-transform: uppercase; tracking-wider: 1px; letter-spacing: 1px;">SẢN PHẨM KHÁCH MUA</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f3f4f6; text-transform: uppercase; font-size: 11px; color: #4b5563; font-weight: 700;">
              <th style="padding: 10px; text-align: left;">Sản phẩm</th>
              <th style="padding: 10px; text-align: center;">SL</th>
              <th style="padding: 10px; text-align: right;">Đơn giá</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHtml}
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 20px; font-size: 16px; font-weight: 700; color: #111827;">
          Tổng số tiền thanh toán: <span style="color: #D4AF37;">${totalStr}</span>
        </div>
      </div>

      <div style="background-color: #fffdf5; border: 1px solid #fef3c7; padding: 20px; margin: 24px 0; font-size: 13px;">
        <h4 style="margin-top: 0; color: #b45309; font-size: 13px; font-weight: 700; text-transform: uppercase; tracking-wider: 1px; letter-spacing: 1px; margin-bottom: 12px;">📍 THÔNG TIN NHẬN HÀNG</h4>
        <div style="color: #374151; space-y: 6px;">
          <p style="margin: 4px 0;"><strong>Họ và tên:</strong> ${order.customer.name}</p>
          <p style="margin: 4px 0;"><strong>Số điện thoại:</strong> ${order.customer.phone}</p>
          <p style="margin: 4px 0;"><strong>Địa chỉ nhận:</strong> ${order.customer.address}</p>
          ${order.customer.note ? `<p style="margin: 4px 0;"><strong>Ghi chú đơn hàng:</strong> <span style="font-style: italic;">${order.customer.note}</span></p>` : ''}
        </div>
      </div>

      <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">Đơn hàng sẽ được bàn giao qua đơn vị vận chuyển cao cấp trong hôm nay. Nếu cần điều chỉnh địa chỉ hoặc thời gian nhận, Quý khách vui lòng liên hệ bộ phận hỗ trợ hoặc phản hồi trực tiếp tới Email này.</p>
      
      <div style="border-top: 1px solid #f3f4f6; margin-top: 40px; padding-top: 20px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0; font-weight: 600; color: #4b5563;">Hệ thống bán hàng công nghệ cao cấp Son Store</p>
        <p style="margin: 4px 0 0 0;">Cảm ơn Quý khách hàng đã tin tưởng lựa chọn sản phẩm thượng lưu thượng đẳng!</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"${config.emailSenderName || 'Son Store'}" <${config.emailUser}>`,
    to: recipient,
    subject: subject,
    html: htmlBody,
  });

  return true;
}
