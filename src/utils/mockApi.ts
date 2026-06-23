import productsData from '../data/products.json';
import { safeLocalStorage } from './storage';

// Simple types
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  note?: string;
}

interface Order {
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

interface AdminToken {
  accessToken: string;
  expiresAt: number;
  email?: string;
  name?: string;
}

interface AdminConfig {
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

// Default states
const DEFAULT_CONFIG: AdminConfig = {
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

// Client storage access helpers
const getLocalOrders = (): Order[] => {
  try {
    const data = safeLocalStorage.getItem('sonstore_orders');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalOrders = (orders: Order[]) => {
  safeLocalStorage.setItem('sonstore_orders', JSON.stringify(orders));
};

const getLocalConfig = (): AdminConfig => {
  try {
    const data = safeLocalStorage.getItem('sonstore_admin_config');
    return data ? JSON.parse(data) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

const saveLocalConfig = (config: AdminConfig) => {
  safeLocalStorage.setItem('sonstore_admin_config', JSON.stringify(config));
};

const getLocalToken = (): AdminToken | null => {
  try {
    const data = safeLocalStorage.getItem('sonstore_admin_token');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveLocalToken = (token: AdminToken | null) => {
  if (token) {
    safeLocalStorage.setItem('sonstore_admin_token', JSON.stringify(token));
  } else {
    safeLocalStorage.removeItem('sonstore_admin_token');
  }
};

// Real client-side interactions to external Google APIs
async function clientSyncOrderToSheets(order: Order, token: string, spreadsheetId: string): Promise<boolean> {
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

  const response = await window.fetch(url, {
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
    throw new Error(`Google Sheets responded: ${errText}`);
  }
  return true;
}

async function clientInitializeSheetHeaders(spreadsheetId: string, token: string) {
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
    await window.fetch(url, {
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
    console.error('Error writing client-side sheet headers', error);
  }
}

async function clientCreateAutomaticSpreadsheet(token: string): Promise<{ id: string, url: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const response = await window.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: "Son Store - Quản Lý Đơn Hàng (Client Mode)"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Sheets creation error code: ${response.status}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  await clientInitializeSheetHeaders(spreadsheetId, token);
  return { id: spreadsheetId, url: spreadsheetUrl };
}

async function clientSendGmailConfirmation(order: Order, token: string): Promise<boolean> {
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
        <p style="margin: 5px 0 0 0; color: #666; font-size: 13px; font-style: italic;">Elevate Your Digital Life (Client Mode)</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #333;">Chào <strong>${order.customer.name}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #333;">Chúng tôi kính gửi thông báo đơn hàng mã <strong>#${order.id}</strong> đã được xác nhận thanh toán thành công và chuẩn bị vận chuyển.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #111; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">CHI TIẾT ĐƠN HÀNG</h3>
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
        <h4 style="margin-top:0; color:#d97706; font-size:14px; font-weight:bold;">📍 THÔNG TIN ĐỊA CHỈ NHẬN</h4>
        <p style="margin: 4px 0;"><strong>Họ tên:</strong> ${order.customer.name}</p>
        <p style="margin: 4px 0;"><strong>Điện thoại:</strong> ${order.customer.phone}</p>
        <p style="margin: 4px 0;"><strong>Địa chỉ:</strong> ${order.customer.address}</p>
      </div>
    </div>
  `;

  // Encode RFC 2822 format manually
  const emailLines = [
    `To: ${recipient}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "",
    htmlBody
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const gmailUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  const response = await window.fetch(gmailUrl, {
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
    const text = await response.text();
    throw new Error(`Gmail API failure code ${response.status}: ${text}`);
  }
  return true;
}

// Direct secure safe client-side fetch router
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
  
  // Check if it is an API route
  if (urlString.startsWith('/api/') || urlString.includes('/api/')) {
    const parsedUrl = new URL(urlString, window.location.origin);
    const pathname = parsedUrl.pathname;
    const method = init?.method?.toUpperCase() || 'GET';

    // 1. GET /api/products
    if (pathname === '/api/products' && method === 'GET') {
      return new Response(JSON.stringify(productsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. GET /api/config
    if (pathname === '/api/config' && method === 'GET') {
      const config = getLocalConfig();
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. GET /api/admin/status
    if (pathname === '/api/admin/status' && method === 'GET') {
      const token = getLocalToken();
      const config = getLocalConfig();
      const isConnected = !!(token && token.accessToken && token.expiresAt > Date.now());
      
      return new Response(JSON.stringify({
        isConnected,
        expiresIn: token ? Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000)) : 0,
        email: token?.email || null,
        name: token?.name || null,
        config
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. POST /api/admin/save-token
    if (pathname === '/api/admin/save-token' && method === 'POST') {
      try {
        const body = JSON.parse(init?.body as string || '{}');
        const expiresAt = Date.now() + (body.expiresIn || 3600) * 1000;
        
        saveLocalToken({
          accessToken: body.accessToken,
          expiresAt,
          email: body.email,
          name: body.name
        });

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Google account authenticated & token saved in localStorage!' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    // 5. POST /api/admin/disconnect
    if (pathname === '/api/admin/disconnect' && method === 'POST') {
      saveLocalToken(null);
      return new Response(JSON.stringify({ success: true, message: 'Disconnected Google Account.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. POST /api/admin/update-config
    if (pathname === '/api/admin/update-config' && method === 'POST') {
      try {
        const body = JSON.parse(init?.body as string || '{}');
        const currentConfig = getLocalConfig();
        const newConfig = {
          ...currentConfig,
          ...body,
          smtpEnabled: body.smtpEnabled === true || body.smtpEnabled === 'true'
        };
        saveLocalConfig(newConfig);
        return new Response(JSON.stringify({ success: true, config: newConfig }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    // 7. GET /api/admin/orders
    if (pathname === '/api/admin/orders' && method === 'GET') {
      const orders = getLocalOrders();
      return new Response(JSON.stringify(orders), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 8. POST /api/orders
    if (pathname === '/api/orders' && method === 'POST') {
      try {
        const { customer, items, total, paymentMethod } = JSON.parse(init?.body as string || '{}');
        if (!customer?.name || !customer?.phone || !customer?.email || !customer?.address) {
          return new Response(JSON.stringify({ error: 'Thiếu thông tin khách hàng bắt buộc.' }), { status: 400 });
        }
        if (!items || !items.length) {
          return new Response(JSON.stringify({ error: 'Giỏ hàng đang trống.' }), { status: 400 });
        }

        const randomCode = Math.floor(10000 + Math.random() * 90000);
        const orderId = `SON-${randomCode}`;
        const newOrder: Order = {
          id: orderId,
          customer,
          items,
          total,
          paymentMethod: paymentMethod || 'WireTransfer',
          status: 'pending',
          createdAt: new Date().toISOString(),
          sheetsSynced: false
        };

        const orders = getLocalOrders();
        orders.unshift(newOrder);
        saveLocalOrders(orders);

        // Auto Sheets sync if admin token connected client-side
        const token = getLocalToken();
        const config = getLocalConfig();
        if (token && token.accessToken && config.spreadsheetId && token.expiresAt > Date.now()) {
          try {
            await clientSyncOrderToSheets(newOrder, token.accessToken, config.spreadsheetId);
            newOrder.sheetsSynced = true;
            
            // Rewrite updated synced state
            const nextOrders = getLocalOrders();
            const opIndex = nextOrders.findIndex(o => o.id === orderId);
            if (opIndex !== -1) {
              nextOrders[opIndex].sheetsSynced = true;
              saveLocalOrders(nextOrders);
            }
          } catch (err: any) {
            console.error('Auto spreadsheet sync failed during checkout (client):', err);
            newOrder.sheetsError = err.message;
          }
        }

        return new Response(JSON.stringify(newOrder), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 9. POST /api/admin/create-sheet
    if (pathname === '/api/admin/create-sheet' && method === 'POST') {
      try {
        const token = getLocalToken();
        if (!token || !token.accessToken || token.expiresAt < Date.now()) {
          return new Response(JSON.stringify({ error: 'Chưa có tài khoản Google liên kết hoặc phiên đã hết hạn.' }), { status: 401 });
        }

        const sheetsResult = await clientCreateAutomaticSpreadsheet(token.accessToken);
        const currentConfig = getLocalConfig();
        const updatedConfig = {
          ...currentConfig,
          spreadsheetId: sheetsResult.id,
          spreadsheetUrl: sheetsResult.url
        };
        saveLocalConfig(updatedConfig);
        return new Response(JSON.stringify({ success: true, config: updatedConfig }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 10. POST /api/admin/orders/:orderId/sync
    const syncMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/sync$/);
    if (syncMatch && method === 'POST') {
      try {
        const orderId = syncMatch[1];
        const orders = getLocalOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy đơn hàng.' }), { status: 404 });
        }

        const token = getLocalToken();
        const config = getLocalConfig();
        if (!token || !token.accessToken || token.expiresAt < Date.now()) {
          return new Response(JSON.stringify({ error: 'Chưa có tài khoản Google liên kết.' }), { status: 401 });
        }
        if (!config.spreadsheetId) {
          return new Response(JSON.stringify({ error: 'Chưa cấu hình Google Sheet ID.' }), { status: 400 });
        }

        await clientSyncOrderToSheets(order, token.accessToken, config.spreadsheetId);
        order.sheetsSynced = true;
        order.sheetsError = undefined;
        saveLocalOrders(orders);

        return new Response(JSON.stringify({ success: true, message: 'Đồng bộ Google Sheets thành công!' }), { status: 200 });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 11. POST /api/admin/orders/:orderId/confirm-payment
    const confirmPaymentMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/confirm-payment$/);
    if (confirmPaymentMatch && method === 'POST') {
      try {
        const orderId = confirmPaymentMatch[1];
        const orders = getLocalOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy đơn hàng.' }), { status: 404 });
        }

        const order = orders[orderIndex];
        order.status = 'paid';

        const token = getLocalToken();
        const config = getLocalConfig();

        // Sync paid status to Google Sheets client-side if possible
        if (token?.accessToken && config.spreadsheetId && token.expiresAt > Date.now()) {
          try {
            await clientSyncOrderToSheets(order, token.accessToken, config.spreadsheetId);
            order.sheetsSynced = true;
            order.sheetsError = undefined;
          } catch (err: any) {
            console.error('Sheet status sync failed client-side:', err);
          }
        }

        // Send confirmation via Gmail API
        let emailSent = false;
        let emailError = '';
        if (token?.accessToken && token.expiresAt > Date.now()) {
          try {
            await clientSendGmailConfirmation(order, token.accessToken);
            order.emailSent = true;
            order.emailError = undefined;
            emailSent = true;
          } catch (err: any) {
            console.error('Gmail API delivery failed client-side:', err);
            emailError = err.message;
            order.emailSent = false;
            order.emailError = err.message;
          }
        } else {
          // SMTP fallback warning on pure static build
          emailError = 'SMTP không khả dụng ở chế độ thuần Client Front-end. Vui lòng liên kết Google OAuth Gmail.';
          order.emailSent = false;
          order.emailError = 'SMTP disabled in client-only static deployment';
        }

        saveLocalOrders(orders);

        return new Response(JSON.stringify({
          success: true,
          order,
          emailSent,
          emailError
        }), { status: 200 });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 12. POST /api/admin/orders/:orderId/send-email
    const sendEmailMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/send-email$/);
    if (sendEmailMatch && method === 'POST') {
      try {
        const orderId = sendEmailMatch[1];
        const orders = getLocalOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy đơn hàng.' }), { status: 404 });
        }

        const token = getLocalToken();
        if (token?.accessToken && token.expiresAt > Date.now()) {
          try {
            await clientSendGmailConfirmation(order, token.accessToken);
            order.emailSent = true;
            order.emailError = undefined;
            saveLocalOrders(orders);
            return new Response(JSON.stringify({ success: true, emailSent: true, order }), { status: 200 });
          } catch (err: any) {
            order.emailSent = false;
            order.emailError = err.message;
            saveLocalOrders(orders);
            return new Response(JSON.stringify({ error: `Gmail error: ${err.message}` }), { status: 500 });
          }
        } else {
          return new Response(JSON.stringify({ error: 'SMTP không hoạt động ở chế độ Static Web. Vui lòng kết nối Google OAuth để gửi Gmail.' }), { status: 400 });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 13. POST /api/admin/orders/:orderId/status
    const statusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'POST') {
      try {
        const orderId = statusMatch[1];
        const { status } = JSON.parse(init?.body as string || '{}');
        const orders = getLocalOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy đơn hàng.' }), { status: 404 });
        }

        order.status = status;

        const token = getLocalToken();
        const config = getLocalConfig();
        if (token?.accessToken && config.spreadsheetId && token.expiresAt > Date.now()) {
          try {
            await clientSyncOrderToSheets(order, token.accessToken, config.spreadsheetId);
            order.sheetsSynced = true;
            order.sheetsError = undefined;
          } catch {}
        }

        saveLocalOrders(orders);
        return new Response(JSON.stringify({ success: true, order }), { status: 200 });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 14. POST /api/admin/test-email
    if (pathname === '/api/admin/test-email' && method === 'POST') {
      return new Response(JSON.stringify({
        error: 'Tính năng SMTP không khả dụng ở chế độ Tĩnh (Static Web Host). Hãy sử dụng Google OAuth để kết nối tài khoản Gmail thật gửi trực tiếp!'
      }), { status: 400 });
    }
  }

  return window.fetch(input, init);
}
