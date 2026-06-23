import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { 
  initDb, 
  getProducts, 
  getOrders, 
  addOrder, 
  updateOrder, 
  getAdminToken, 
  saveAdminToken, 
  getAdminConfig, 
  saveAdminConfig, 
  syncOrderToSheets, 
  createAutomaticSpreadsheet,
  sendGmailConfirmation,
  sendSmtpConfirmation,
  Order
} from './src/data/db.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  // Initialize Database
  initDb();

  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route: Get all products
  app.get('/api/products', (req, res) => {
    try {
      const items = getProducts();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Get shop configuration (Bank info, Sheet links)
  app.get('/api/config', (req, res) => {
    try {
      const config = getAdminConfig();
      // Remove sensitive items if any (none exist so far)
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Checkout (Create order)
  app.post('/api/orders', async (req, res) => {
    try {
      const { customer, items, total, paymentMethod } = req.body;
      
      if (!customer?.name || !customer?.phone || !customer?.email || !customer?.address) {
        return res.status(400).json({ error: 'Thiếu thông tin khách hàng bắt buộc.' });
      }
      if (!items || !items.length) {
        return res.status(400).json({ error: 'Giỏ hàng đang trống.' });
      }

      // Generate a sleek order code like SON-XXXXX
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

      // Save order in local DB
      addOrder(newOrder);

      // Attempt to auto-sync to Sheets if admin is already logged in
      const adminToken = getAdminToken();
      const adminConfig = getAdminConfig();

      if (adminToken && adminToken.accessToken && adminConfig.spreadsheetId) {
        // Quick check token expiry
        if (adminToken.expiresAt > Date.now()) {
          try {
            await syncOrderToSheets(newOrder, adminToken.accessToken, adminConfig.spreadsheetId);
            updateOrder(orderId, { sheetsSynced: true });
            newOrder.sheetsSynced = true;
          } catch (syncErr: any) {
            console.error('Auto spreadsheet sync failed during checkout', syncErr);
            updateOrder(orderId, { sheetsError: syncErr.message });
            newOrder.sheetsError = syncErr.message;
          }
        } else {
          console.warn('Admin Google token expired, skipping auto-sync to Google Sheets.');
          updateOrder(orderId, { sheetsError: 'Token expired' });
        }
      }

      res.status(201).json(newOrder);
    } catch (err: any) {
      console.error('Error creating order', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ADMIN ENDPOINTS

  // Check connection status of Google services
  app.get('/api/admin/status', (req, res) => {
    try {
      const token = getAdminToken();
      const config = getAdminConfig();
      const isConnected = !!(token && token.accessToken && token.expiresAt > Date.now());
      
      res.json({
        isConnected,
        expiresIn: token ? Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000)) : 0,
        email: token?.email || null,
        name: token?.name || null,
        config
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save the OAuth token from frontend on admin login
  app.post('/api/admin/save-token', (req, res) => {
    try {
      const { accessToken, expiresIn, email, name } = req.body;
      if (!accessToken) {
        return res.status(400).json({ error: 'Yêu cầu accessToken.' });
      }

      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
      saveAdminToken({
        accessToken,
        expiresAt,
        email,
        name
      });

      res.json({ success: true, message: 'Google account authenticated & token saved!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin disconnects Google
  app.post('/api/admin/disconnect', (req, res) => {
    try {
      saveAdminToken(null);
      res.json({ success: true, message: 'Disconnected Google Account.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update bank and configuration info
  app.post('/api/admin/update-config', (req, res) => {
    try {
      const { 
        bankName, bankAccount, bankAccountName, spreadsheetId, spreadsheetUrl,
        emailHost, emailPort, emailUser, emailPass, emailSenderName, smtpEnabled 
      } = req.body;
      const currentConfig = getAdminConfig();

      const newConfig = {
        spreadsheetId: spreadsheetId !== undefined ? spreadsheetId : currentConfig.spreadsheetId,
        spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl : currentConfig.spreadsheetUrl,
        bankName: bankName || currentConfig.bankName,
        bankAccount: bankAccount || currentConfig.bankAccount,
        bankAccountName: bankAccountName || currentConfig.bankAccountName,
        emailHost: emailHost !== undefined ? emailHost : currentConfig.emailHost,
        emailPort: emailPort !== undefined ? Number(emailPort) : currentConfig.emailPort,
        emailUser: emailUser !== undefined ? emailUser : currentConfig.emailUser,
        emailPass: emailPass !== undefined ? emailPass : currentConfig.emailPass,
        emailSenderName: emailSenderName !== undefined ? emailSenderName : currentConfig.emailSenderName,
        smtpEnabled: smtpEnabled !== undefined ? (smtpEnabled === true || smtpEnabled === 'true') : currentConfig.smtpEnabled,
      };

      saveAdminConfig(newConfig);
      res.json({ success: true, config: newConfig });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Send test email via SMTP
  app.post('/api/admin/test-email', async (req, res) => {
    try {
      const { emailHost, emailPort, emailUser, emailPass, emailSenderName, testRecipient } = req.body;
      
      if (!emailUser || !emailPass || !testRecipient) {
        return res.status(400).json({ error: 'Thiếu email gửi, mật khẩu ứng dụng, hoặc email nhận thử.' });
      }

      const transporter = nodemailer.createTransport({
        host: emailHost || 'smtp.gmail.com',
        port: Number(emailPort) || 465,
        secure: Number(emailPort) === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"${emailSenderName || 'Son Store'}" <${emailUser}>`,
        to: testRecipient,
        subject: `[Son Store] Thử nghiệm kết nối SMTP thành công!`,
        html: `
          <div style="font-family: sans-serif; padding: 25px; border: 1px solid #eee; max-width: 500px; margin: auto;">
            <h2 style="color: #D4AF37;">Kết nối SMTP thành công!</h2>
            <p>Hệ thống gửi thư của bạn đã hoạt động trơn tru. Đây là thư nghiệm tự động được kích hoạt từ trang quản trị Son Store Admin Panel.</p>
            <p style="font-size: 11px; color: #888;">Nguồn phát: ${emailUser} | Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        `
      });

      res.json({ success: true, message: 'Thư thử nghiệm đã được gửi thành công!' });
    } catch (err: any) {
      console.error('SMTP test failure', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get all orders (Admin Panel)
  app.get('/api/admin/orders', (req, res) => {
    try {
      const orders = getOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new spreadsheet on fly
  app.post('/api/admin/create-sheet', async (req, res) => {
    try {
      const adminToken = getAdminToken();
      if (!adminToken || !adminToken.accessToken || adminToken.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Google Account is not connected or session expired.' });
      }

      const sheetDetails = await createAutomaticSpreadsheet(adminToken.accessToken);
      
      const currentConfig = getAdminConfig();
      const updatedConfig = {
        ...currentConfig,
        spreadsheetId: sheetDetails.id,
        spreadsheetUrl: sheetDetails.url
      };
      
      saveAdminConfig(updatedConfig);
      res.json({ success: true, config: updatedConfig });
    } catch (err: any) {
      console.error('Error creating spreadsheet', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Sync a single order manually to Google Sheets
  app.post('/api/admin/orders/:orderId/sync', async (req, res) => {
    try {
      const { orderId } = req.params;
      const orders = getOrders();
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      }

      const adminToken = getAdminToken();
      const adminConfig = getAdminConfig();

      if (!adminToken || !adminToken.accessToken || adminToken.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Google Account is not connected or session expired.' });
      }
      if (!adminConfig.spreadsheetId) {
        return res.status(400).json({ error: 'Chưa cấu hình Google Sheet ID.' });
      }

      await syncOrderToSheets(order, adminToken.accessToken, adminConfig.spreadsheetId);
      updateOrder(orderId, { sheetsSynced: true, sheetsError: undefined });

      res.json({ success: true, message: 'Đã đồng bộ hóa với Google Sheets thành công!' });
    } catch (err: any) {
      console.error('Manual sheet sync failed', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin confirms receipt of wire transfer, updates order status, and triggers confirmation email
  app.post('/api/admin/orders/:orderId/confirm-payment', async (req, res) => {
    try {
      const { orderId } = req.params;
      const orders = getOrders();
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      }

      // Update order status to paid
      const updatedOrder = updateOrder(orderId, { status: 'paid' });
      if (!updatedOrder) {
        return res.status(500).json({ error: 'Không thể cập nhật đơn hàng.' });
      }

      // Trigger automatic sync if Sheet ID exists
      const adminToken = getAdminToken();
      const adminConfig = getAdminConfig();

      let sheetsUpdated = updatedOrder.sheetsSynced;
      if (adminToken?.accessToken && adminConfig.spreadsheetId && adminToken.expiresAt > Date.now()) {
        try {
          // Sync current paid status to sheet as well
          await syncOrderToSheets(updatedOrder, adminToken.accessToken, adminConfig.spreadsheetId);
          updateOrder(orderId, { sheetsSynced: true, sheetsError: undefined });
          sheetsUpdated = true;
        } catch (sheetErr) {
          console.error('Failed to sync updated status to sheet', sheetErr);
        }
      }

      // Send Confirmation Email
      let emailSent = false;
      let emailError = '';

      if (adminConfig && adminConfig.smtpEnabled) {
        try {
          console.log(`Sending order confirmation for order ${orderId} via SMTP...`);
          await sendSmtpConfirmation(updatedOrder, adminConfig);
          updateOrder(orderId, { emailSent: true, emailError: undefined });
          emailSent = true;
        } catch (smtpErr: any) {
          console.error('SMTP delivery failed', smtpErr);
          emailError = `SMTP error: ${smtpErr.message}`;
          updateOrder(orderId, { emailSent: false, emailError: `SMTP: ${smtpErr.message}` });
        }
      }

      // Fallback to Gmail OAuth if SMTP is not active or failed
      if (!emailSent && adminToken?.accessToken && adminToken.expiresAt > Date.now()) {
        try {
          console.log(`Sending order confirmation for order ${orderId} via Gmail API OAuth...`);
          await sendGmailConfirmation(updatedOrder, adminToken.accessToken);
          updateOrder(orderId, { emailSent: true, emailError: undefined });
          emailSent = true;
          emailError = ''; // wipe error since fallback worked
        } catch (mailErr: any) {
          console.error('Gmail delivery failed', mailErr);
          if (!emailError) emailError = `Gmail API error: ${mailErr.message}`;
          updateOrder(orderId, { emailSent: false, emailError: `Gmail API: ${mailErr.message}` });
        }
      }

      const finalOrder = getOrders().find(o => o.id === orderId) || updatedOrder;

      res.json({
        success: true,
        order: {
          ...finalOrder,
          sheetsSynced: sheetsUpdated
        },
        emailSent,
        emailError
      });
    } catch (err: any) {
      console.error('Error confirming payment', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Send/Resend manual order confirmation email
  app.post('/api/admin/orders/:orderId/send-email', async (req, res) => {
    try {
      const { orderId } = req.params;
      const orders = getOrders();
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      }

      const adminToken = getAdminToken();
      const adminConfig = getAdminConfig();

      let emailSent = false;
      let emailError = '';

      if (adminConfig && adminConfig.smtpEnabled) {
        try {
          console.log(`Sending manual order confirmation for order ${orderId} via SMTP...`);
          await sendSmtpConfirmation(order, adminConfig);
          updateOrder(orderId, { emailSent: true, emailError: undefined });
          emailSent = true;
        } catch (smtpErr: any) {
          console.error('SMTP manual delivery failed', smtpErr);
          emailError = `SMTP error: ${smtpErr.message}`;
          updateOrder(orderId, { emailSent: false, emailError: `SMTP: ${smtpErr.message}` });
        }
      }

      if (!emailSent && adminToken?.accessToken && adminToken.expiresAt > Date.now()) {
        try {
          console.log(`Sending manual order confirmation for order ${orderId} via Gmail API OAuth...`);
          await sendGmailConfirmation(order, adminToken.accessToken);
          updateOrder(orderId, { emailSent: true, emailError: undefined });
          emailSent = true;
          emailError = ''; 
        } catch (mailErr: any) {
          console.error('Gmail manual delivery failed', mailErr);
          if (!emailError) emailError = `Gmail API error: ${mailErr.message}`;
          updateOrder(orderId, { emailSent: false, emailError: `Gmail API: ${mailErr.message}` });
        }
      }

      if (!emailSent && !adminConfig.smtpEnabled && (!adminToken || adminToken.expiresAt < Date.now())) {
        return res.status(400).json({ error: 'Hệ thống gửi thư chưa được cấu hình. Vui lòng bật SMTP hoặc liên kết Google OAuth.' });
      }

      res.json({
        success: emailSent,
        emailSent,
        emailError,
        order: getOrders().find(o => o.id === orderId)
      });
    } catch (err: any) {
      console.error('Error sending manual email', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin marks order status change
  app.post('/api/admin/orders/:orderId/status', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'paid', 'shipped', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
      }

      const updated = updateOrder(orderId, { status });
      if (!updated) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      }

      // Re-sync to Sheet if possible
      const adminToken = getAdminToken();
      const adminConfig = getAdminConfig();
      if (adminToken?.accessToken && adminConfig.spreadsheetId && adminToken.expiresAt > Date.now()) {
        try {
          await syncOrderToSheets(updated, adminToken.accessToken, adminConfig.spreadsheetId);
          updateOrder(orderId, { sheetsSynced: true, sheetsError: undefined });
        } catch (e) {
          console.error('Failed to sync updated status to sheet', e);
        }
      }

      res.json({ success: true, order: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // INTEGRATE VITE FOR MIDDLEWARE ROUTING
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve HTML
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Son Store Fullstack] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer().catch((err) => {
  console.error('Failed to boot Express server:', err);
});
