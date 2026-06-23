import { useState, useEffect } from 'react';
import { Order, AdminStatus } from '../types';
import { apiFetch } from '../utils/mockApi';
import { 
  ArrowLeft, RefreshCw, Layers, DollarSign, Check, X, 
  FileSpreadsheet, Mail, Edit, CheckCircle, ExternalLink, 
  ShieldAlert, Settings, Copy, CreditCard, Send, Lock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  onBack: () => void;
  adminStatus: AdminStatus | null;
  onRefreshStatus: () => void;
}

export default function AdminPanel({ onBack, adminStatus, onRefreshStatus }: AdminPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'sheets' | 'email' | 'settings'>('orders');
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [selectedOrderEmail, setSelectedOrderEmail] = useState<Order | null>(null);
  const [authMockOpen, setAuthMockOpen] = useState(false);

  // Editable Store & SMTP Configurations
  const [bankConfig, setBankConfig] = useState({
    bankName: '',
    bankAccount: '',
    bankAccountName: '',
    emailHost: 'smtp.gmail.com',
    emailPort: 465,
    emailUser: '',
    emailPass: '',
    emailSenderName: 'Son Store',
    smtpEnabled: false
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-sync spreadsheet details
  const [spreadsheetIdIn, setSpreadsheetIdIn] = useState('');
  const [creatingSheet, setCreatingSheet] = useState(false);

  // SMTP Live tests
  const [testRecipient, setTestRecipient] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState('');
  const [smtpError, setSmtpError] = useState('');

  const handleTestSmtp = async () => {
    if (!bankConfig.emailUser || !bankConfig.emailPass) {
      setSmtpError('Vui lòng điền Email gửi và Mật khẩu ứng dụng trước.');
      return;
    }
    const rec = testRecipient.trim() || bankConfig.emailUser;
    
    setTestingSmtp(true);
    setSmtpSuccess('');
    setSmtpError('');
    try {
      const response = await apiFetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailHost: bankConfig.emailHost,
          emailPort: bankConfig.emailPort,
          emailUser: bankConfig.emailUser,
          emailPass: bankConfig.emailPass,
          emailSenderName: bankConfig.emailSenderName,
          testRecipient: rec
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSmtpSuccess(`Đã gửi thành công thư kiểm tra tới địa chỉ: ${rec}. Bạn hãy kiểm tra Hộp thư đến (Inbox) hoặc Spam.`);
      } else {
        setSmtpError(data.error || 'Gửi thư thử nghiệm thất bại.');
      }
    } catch (err: any) {
      setSmtpError(`Lỗi kết nối: ${err.message}`);
    } finally {
      setTestingSmtp(false);
    }
  };

  // Fetch orders from server
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/admin/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching admin orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (adminStatus?.config) {
      setBankConfig({
        bankName: adminStatus.config.bankName,
        bankAccount: adminStatus.config.bankAccount,
        bankAccountName: adminStatus.config.bankAccountName,
        emailHost: adminStatus.config.emailHost || 'smtp.gmail.com',
        emailPort: adminStatus.config.emailPort || 465,
        emailUser: adminStatus.config.emailUser || '',
        emailPass: adminStatus.config.emailPass || '',
        emailSenderName: adminStatus.config.emailSenderName || 'Son Store',
        smtpEnabled: !!adminStatus.config.smtpEnabled
      });
      setSpreadsheetIdIn(adminStatus.config.spreadsheetId || '');
    }
  }, [adminStatus]);

  // Handle manual spreadsheet sync
  const handleManualSync = async (orderId: string) => {
    setSyncingOrderId(orderId);
    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}/sync`, {
        method: 'POST'
      });
      const resData = await response.json();
      if (response.ok) {
        setSuccessMsg(`Đã đồng bộ đơn hàng ${orderId} lên Google Sheets!`);
        fetchOrders();
        onRefreshStatus();
      } else {
        alert(`Đồng bộ thất bại: ${resData.error || 'Lỗi chưa xác định.'}`);
      }
    } catch (err: any) {
      alert(`Lỗi đồng bộ: ${err.message}`);
    } finally {
      setSyncingOrderId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Confirm wire transfer & mark paid
  const handleConfirmPayment = async (orderId: string) => {
    setConfirmingOrderId(orderId);
    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: 'POST'
      });
      const resData = await response.json();
      
      if (response.ok) {
        setSuccessMsg(`Đã xác nhận thanh toán đơn #${orderId}! Email hóa đơn đã được gửi.`);
        fetchOrders();
        onRefreshStatus();
      } else {
        alert(`Xác nhận thất bại: ${resData.error || 'Lỗi chưa xác định.'}`);
      }
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err.message}`);
    } finally {
      setConfirmingOrderId(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // Resend or manually send order confirmation email
  const handleResendEmail = async (orderId: string) => {
    setResendingEmailId(orderId);
    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}/send-email`, {
        method: 'POST'
      });
      const resData = await response.json();
      
      if (response.ok) {
        setSuccessMsg(`Đã gửi email hòm thư xác nhận cho đơn #${orderId} thành công!`);
        fetchOrders();
        onRefreshStatus();
      } else {
        alert(`Gửi email thất bại: ${resData.error || 'Lỗi chưa xác định.'}`);
      }
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err.message}`);
    } finally {
      setResendingEmailId(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // Update shop configurations
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setSuccessMsg('');
    try {
      const response = await apiFetch('/api/admin/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bankConfig,
          spreadsheetId: spreadsheetIdIn
        })
      });
      if (response.ok) {
        setSuccessMsg('Đã lưu cấu hình ngân hàng thành công!');
        onRefreshStatus();
      }
    } catch (error) {
      console.error('Error saving bank configs', error);
    } finally {
      setSavingConfig(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Auto-generate fresh Google sheet in admin account
  const handleCreateAutoSheet = async () => {
    setCreatingSheet(true);
    try {
      const response = await apiFetch('/api/admin/create-sheet', {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setSpreadsheetIdIn(data.config.spreadsheetId);
        setSuccessMsg('Đã khởi tạo và liên kết Google Sheet mới thành công!');
        onRefreshStatus();
      } else {
        alert(data.error || 'Không thể tạo bảng dữ liệu mới. Hãy kiểm tra kết nối Google.');
      }
    } catch (error) {
      console.error('Error creating auto spreadsheet', error);
    } finally {
      setCreatingSheet(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Mock authenticate (to give user immediate satisfaction on static preview)
  const handleMockAuthenticate = async (type: 'demo' | 'real') => {
    if (type === 'demo') {
      try {
        const response = await apiFetch('/api/admin/save-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: 'MOCK_GOOGLE_OAUTH_TOKEN_ACTIVE',
            expiresIn: 3600,
            email: 'admin.sonstore@gmail.com',
            name: 'Nguyễn Hoàng Sơn'
          })
        });
        if (response.ok) {
          setSuccessMsg('Đồng bộ hoá chế độ chạy Demo với Google Account thành công!');
          onRefreshStatus();
          setAuthMockOpen(false);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Real flow instructions or popup if Firebase is configured
      alert('Vui lòng cấp thông tin Google API hoặc kết nối OAuth. Đang chạy Chế độ Demo thay thế!');
      handleMockAuthenticate('demo');
    }
  };

  // Disconnect Google account
  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn ngắt kết nối Google Account?')) return;
    try {
      const response = await apiFetch('/api/admin/disconnect', { method: 'POST' });
      if (response.ok) {
        setSuccessMsg('Đã ngắt kết nối Google!');
        onRefreshStatus();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Stats calculate
  const totalRevenue = orders
    .filter(o => o.status === 'paid' || o.status === 'shipped')
    .reduce((val, o) => val + o.total, 0);

  const pendingPayments = orders
    .filter(o => o.status === 'pending')
    .reduce((val, o) => val + o.total, 0);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header navigation bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-850">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">Son Store Admin Panel</h1>
                <span className="text-[10px] bg-sky-500/10 text-sky-500 font-mono px-2 py-0.5 rounded">V1.2</span>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Trang quản trị vận hành, cấu hình ngân hàng & đồng bộ hóa Google</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOrders}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Global Banner Success message */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex gap-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Status Dashboard card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Revenue aggregate Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Doanh thu thực nhận (đã CK)</p>
              <h4 className="text-lg font-mono font-bold text-zinc-950 dark:text-white mt-1">{formatVND(totalRevenue)}</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5">Tính từ đơn hàng ở trạng thái 'Đã gõ' / 'Đã gửi'</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Số dư đơn hàng treo (Pending)</p>
              <h4 className="text-lg font-mono font-bold text-zinc-950 dark:text-white mt-1">{formatVND(pendingPayments)}</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5">Khách hàng đã nộp đơn nhưng chưa đối soát TK</p>
            </div>
          </div>

          {/* Sync Status Connector Card */}
          <div className={`bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs flex flex-col justify-between ${adminStatus?.isConnected ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'}`}>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Google Connector API</span>
                <h4 className="text-sm font-semibold mt-1 flex items-center gap-1.5 text-zinc-950 dark:text-white">
                  {adminStatus?.isConnected ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>Đã liên kết Google Account</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span>Google chưa kết nối</span>
                    </>
                  )}
                </h4>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] border-t border-zinc-50 dark:border-zinc-850 pt-2 text-zinc-400 dark:text-zinc-500">
              {adminStatus?.isConnected ? (
                <>
                  <span className="font-mono truncate max-w-[150px]">{adminStatus.email}</span>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="text-red-500 hover:underline font-semibold cursor-pointer"
                  >
                    Hùy liên kết
                  </button>
                </>
              ) : (
                <>
                  <span>Chạy demo cục bộ</span>
                  <button
                    onClick={() => setAuthMockOpen(true)}
                    className="text-sky-500 hover:underline font-semibold cursor-pointer"
                  >
                    Kích hoạt Sheets
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Tab bar */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-850 gap-6 text-xs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 font-semibold transition-colors border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${activeTab === 'orders' ? 'border-zinc-900 dark:border-white text-zinc-950 dark:text-white' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Layers className="h-4 w-4" />
            <span>Danh sách đơn hàng ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`pb-3 font-semibold transition-colors border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${activeTab === 'sheets' ? 'border-zinc-900 dark:border-white text-zinc-950 dark:text-white' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Bàn làm việc Google Sheets</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 font-semibold transition-colors border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${activeTab === 'settings' ? 'border-zinc-900 dark:border-white text-zinc-950 dark:text-white' : 'border-transparent text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Settings className="h-4 w-4" />
            <span>Cấu hình Ngân hàng & Tệp</span>
          </button>
        </div>

        {/* Dynamic Display Panel */}
        <div>
          {/* TAB 1: Order List */}
          {activeTab === 'orders' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl overflow-hidden shadow-xs">
              {isLoading ? (
                <div className="py-20 text-center text-xs text-zinc-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
                  <span>Đang tải danh sách đơn hàng...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-20 text-center text-xs text-zinc-400">
                  <Layers className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
                  <span>Không có đơn hàng nào được ghi nhận.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-850 text-zinc-400 dark:text-zinc-500 font-semibold">
                        <th className="px-5 py-4">Mã đơn hàng</th>
                        <th className="px-5 py-4">Khách hàng</th>
                        <th className="px-5 py-4 w-40">Sản phẩm kỹ thuật</th>
                        <th className="px-5 py-4 font-mono">Tổng tiền</th>
                        <th className="px-5 py-4">Trạng thái</th>
                        <th className="px-5 py-4">Google Sheet</th>
                        <th className="px-5 py-4">Email</th>
                        <th className="px-5 py-4 text-right">Thao tác xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                      {orders.map(order => {
                        const dateText = new Date(order.createdAt).toLocaleString('vi-VN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <tr key={order.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-950/25 transition-colors">
                            <td className="px-5 py-4 font-mono font-semibold">
                              <div>{order.id}</div>
                              <span className="text-[10px] text-zinc-400 font-light font-sans">{dateText}</span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{order.customer.name}</div>
                              <div className="text-[10px] text-zinc-400 font-light">{order.customer.phone} • {order.customer.email}</div>
                              <div className="text-[10px] mt-0.5 max-w-[180px] truncate text-zinc-500">{order.customer.address}</div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-0.5 max-w-[160px]">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="truncate text-zinc-805 text-[11px]">
                                    • {item.name} <span className="font-mono text-zinc-400">({item.quantity})</span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="px-5 py-4 font-mono font-semibold text-zinc-900 dark:text-white">
                              {formatVND(order.total)}
                            </td>

                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                                order.status === 'paid' && 'bg-emerald-500/10 text-emerald-500' ||
                                order.status === 'shipped' && 'bg-indigo-500/10 text-indigo-500' ||
                                order.status === 'pending' && 'bg-amber-500/10 text-amber-500' ||
                                'bg-zinc-200 dark:bg-zinc-800 text-zinc-600'
                              }`}>
                                {order.status === 'pending' && 'Đang đợi'}
                                {order.status === 'paid' && 'Đã thanh toán'}
                                {order.status === 'shipped' && 'Đã giao'}
                                {order.status === 'cancelled' && 'Đã hủy'}
                              </span>
                            </td>

                            {/* Sync Status Link */}
                            <td className="px-5 py-4">
                              {order.sheetsSynced ? (
                                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                                  <Check className="h-3.5 w-3.5 shrink-0" />
                                  <span>Đã đồng bộ</span>
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="text-zinc-400 dark:text-zinc-500">Chưa tải lên</span>
                                  <button
                                    onClick={() => handleManualSync(order.id)}
                                    disabled={syncingOrderId === order.id}
                                    className="text-[10px] text-sky-500 hover:underline font-semibold cursor-pointer"
                                  >
                                    {syncingOrderId === order.id ? 'Đang gửi...' : 'Đẩy lên ngay'}
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Email Status Link */}
                            <td className="px-5 py-4">
                              {order.emailSent ? (
                                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                                  <Check className="h-3.5 w-3.5 shrink-0" />
                                  <span>Đã gửi</span>
                                </span>
                              ) : order.emailError ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  <span className="text-red-500 font-medium flex items-center gap-1" title={order.emailError}>
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    <span>Lỗi gửi thư</span>
                                  </span>
                                  <span className="text-[10px] text-zinc-400 line-clamp-1 max-w-[125px] italic" title={order.emailError}>
                                    {order.emailError}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-500">Chưa gửi</span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex flex-col sm:flex-row gap-1.5 justify-end">
                                {order.status === 'pending' ? (
                                  <button
                                    onClick={() => handleConfirmPayment(order.id)}
                                    disabled={confirmingOrderId === order.id}
                                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
                                  >
                                    {confirmingOrderId === order.id ? 'Đang xử lý...' : 'Xác nhận Đã CK & Gửi Email'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleResendEmail(order.id)}
                                    disabled={resendingEmailId === order.id}
                                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    {resendingEmailId === order.id ? (
                                      <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />
                                    ) : (
                                      <Send className="h-3 w-3 text-zinc-500" />
                                    )}
                                    <span>{order.emailSent ? 'Gửi lại Email' : 'Gửi Email'}</span>
                                  </button>
                                )}

                                {/* Email visualizer receipt preview */}
                                <button
                                  onClick={() => setSelectedOrderEmail(order)}
                                  className="px-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                                >
                                  <Mail className="h-3 w-3" />
                                  <span>Xem hóa đơn</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Grid view mimicking Google Sheets */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">Kiểm tra đồng bộ Google Sheets</p>
                      {adminStatus?.config?.spreadsheetId ? (
                        <p className="mt-0.5 text-zinc-400 truncate max-w-[250px] font-mono">{adminStatus.config.spreadsheetId}</p>
                      ) : (
                        <p className="mt-0.5 text-zinc-400">Bảng dữ liệu đám mây chưa được liên kết.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {adminStatus?.config?.spreadsheetUrl ? (
                      <a
                        href={adminStatus.config.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-2 bg-zinc-105 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <span>Mở Google Sheet thực tế</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      adminStatus?.isConnected && (
                        <button
                          onClick={handleCreateAutoSheet}
                          disabled={creatingSheet}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${creatingSheet ? 'animate-spin' : ''}`} />
                          <span>Tạo mới & liên kết tự động</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Grid visual sheet block */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">Demo Bảng dữ liệu Son Store (Live Viewer)</h3>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 shadow-lg rounded-2xl overflow-hidden font-mono text-[11px]">
                  {/* Table header bar mimics real spreadsheets */}
                  <div className="bg-[#107c41] text-white px-4 py-2.5 flex justify-between items-center">
                    <span className="font-semibold">Son Store - Quản Lý Đơn Hàng.xlsx</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded tracking-wide font-sans">Active Live Sync</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800 w-12 text-center bg-zinc-200/50 dark:bg-zinc-950"></th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">Mã đơn</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">Họ tên KH</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">SĐT</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">Email nhận mail</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">Địa chỉ giao hàng</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800">Sản phẩm kỹ thuật</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800 text-right">Tổng thành toán</th>
                          <th className="px-3.5 py-2 border-r border-zinc-200 dark:border-zinc-800 text-center">Trạng thái</th>
                          <th className="px-3.5 py-2">Ghi chú KH</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {orders.length === 0 ? (
                          <tr>
                            <td className="px-3.5 py-10 text-center text-zinc-400 text-xs" colSpan={10}>
                              Bảng dữ liệu hàng không có dữ liệu đơn hàng.
                            </td>
                          </tr>
                        ) : (
                          orders.map((order, i) => {
                            const itemsSummarized = order.items.map(item => `${item.name} (${item.quantity})`).join('\n');
                            return (
                              <tr key={order.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-950/20 font-mono text-[10px]">
                                <td className="px-3.5 py-2.5 text-center text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950 font-bold">{i + 1}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">{order.id}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 truncate max-w-[120px]">{order.customer.name}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 font-mono">{order.customer.phone}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 truncate max-w-[120px] font-sans">{order.customer.email}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 truncate max-w-[150px] font-sans">{order.customer.address}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 truncate max-w-[150px] font-sans whitespace-pre">{itemsSummarized}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 text-right font-bold text-zinc-950 dark:text-white">{formatVND(order.total)}</td>
                                <td className="px-3.5 py-2.5 border-r border-zinc-200 dark:border-zinc-800 text-center font-bold">
                                  <span className={order.status === 'paid' || order.status === 'shipped' ? 'text-emerald-600' : 'text-amber-500'}>
                                    {order.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 font-sans italic text-zinc-405 truncate max-w-[120px]">{order.customer.note || ''}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Configuration & System Settings */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payment configs */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm font-semibold text-zinc-950 dark:text-white">
                  <CreditCard className="h-4 w-4 text-sky-500" />
                  <span>Cấu hình thông tin nhận chuyển khoản (QR)</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-zinc-500 mb-1.5">Tên Ngân hàng / ID thanh toán</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white"
                      value={bankConfig.bankName}
                      onChange={e => setBankConfig({ ...bankConfig, bankName: e.target.value })}
                      placeholder="MB Bank, Techcombank..."
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-500 mb-1.5">Số tài khoản hưởng thụ</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 font-mono text-zinc-900 dark:text-white"
                      value={bankConfig.bankAccount}
                      onChange={e => setBankConfig({ ...bankConfig, bankAccount: e.target.value })}
                      placeholder="Số tài khoản"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-500 mb-1.5">Họ tên chủ tài khoản (Viết KHÔNG DẤU)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 uppercase text-zinc-900 dark:text-white"
                      value={bankConfig.bankAccountName}
                      onChange={e => setBankConfig({ ...bankConfig, bankAccountName: e.target.value })}
                      placeholder="NGUYEN HOANG SON"
                    />
                  </div>

                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="mt-4 w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg font-semibold transition"
                  >
                    {savingConfig ? 'Đang lưu...' : 'Lưu thông tin ngân hàng'}
                  </button>
                </div>
              </div>

              {/* Sheet linkages */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm font-semibold text-zinc-950 dark:text-white">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>Đồng bộ hóa Google Sheets API</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="p-3.5 bg-zinc-100/50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-850 font-light leading-relaxed text-zinc-400 dark:text-zinc-500">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-300">💡 Hướng dẫn cấu hình:</p>
                    <p className="mt-1">
                      Khi có đơn hàng mới của khách gõ, hệ thống sẽ cố gắng xuất đơn hàng ngay lập tức vào file Google Sheet của bạn. Quá trình xử lý chạy ngầm, không tác động tới khách hàng.
                    </p>
                    {adminStatus?.isConnected ? (
                      <p className="mt-2 text-emerald-500 font-semibold">✓ Đã nhận liên kết API tài khoản Gmail của admin.</p>
                    ) : (
                      <p className="mt-2 text-amber-500 font-semibold">⚠ Google chưa kết nối. Sẽ dán liên kết bằng chế độ Demo mô phỏng cực kỳ trực quan.</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-500 mb-1.5">ID Bảng tính (Spreadsheet ID) liên kết</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono"
                      value={spreadsheetIdIn}
                      onChange={e => setSpreadsheetIdIn(e.target.value)}
                      placeholder="1W_g_7F7X6fH-6z6CqU9uivshl7v..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveConfig}
                      className="flex-1 py-1.5 border border-zinc-200 dark:border-zinc-800 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-lg text-xs"
                    >
                      Cập nhật ID
                    </button>

                    {adminStatus?.isConnected && (
                      <button
                        onClick={handleCreateAutoSheet}
                        disabled={creatingSheet}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white rounded-lg text-xs transition"
                      >
                        {creatingSheet ? 'Đang tạo...' : 'Tự động tạo Sheet mới'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SMTP Custom Email Server */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm font-semibold text-zinc-950 dark:text-white">
                  <Mail className="h-4 w-4 text-amber-500" />
                  <span>Tổng đài Email tự phát (SMTP)</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Toggle Option */}
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-205">Kích hoạt Gửi thư SMTP</span>
                    <input
                      type="checkbox"
                      checked={bankConfig.smtpEnabled}
                      onChange={e => setBankConfig({ ...bankConfig, smtpEnabled: e.target.checked })}
                      className="rounded border-zinc-350 text-amber-500 focus:ring-amber-500/50 h-4 w-4 cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                        value={bankConfig.emailHost}
                        onChange={e => setBankConfig({ ...bankConfig, emailHost: e.target.value })}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Cổng</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
                        value={bankConfig.emailPort}
                        onChange={e => setBankConfig({ ...bankConfig, emailPort: Number(e.target.value) })}
                        placeholder="465"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Tên Người gửi (Sender Name)</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                      value={bankConfig.emailSenderName}
                      onChange={e => setBankConfig({ ...bankConfig, emailSenderName: e.target.value })}
                      placeholder="Son Store"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Email phát đi (Username)</label>
                    <input
                      type="email"
                      className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                      value={bankConfig.emailUser}
                      onChange={e => setBankConfig({ ...bankConfig, emailUser: e.target.value })}
                      placeholder="vidu@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Mật khẩu ứng dụng (App Password)</label>
                    <input
                      type="password"
                      className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-100 dark:text-white focus:outline-none focus:border-amber-500"
                      value={bankConfig.emailPass}
                      onChange={e => setBankConfig({ ...bankConfig, emailPass: e.target.value })}
                      placeholder="aaaa bbbb cccc dddd"
                    />
                  </div>

                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-xs transition duration-300 cursor-pointer"
                  >
                    {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
                  </button>

                  <div className="border-t border-zinc-150 dark:border-zinc-800 pt-3 space-y-2">
                    <label className="block text-[10px] uppercase font-bold text-amber-500">🧪 Thử nghiệm SMTP tức thời</label>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        placeholder="Nhập email nhận thử..."
                        className="flex-1 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                        value={testRecipient}
                        onChange={e => setTestRecipient(e.target.value)}
                      />
                      <button
                        onClick={handleTestSmtp}
                        disabled={testingSmtp}
                        className="px-3 py-1.5 bg-amber-500 text-black font-semibold text-[11px] rounded-lg hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        {testingSmtp && <RefreshCw className="h-3 w-3 animate-spin" />}
                        Gửi Test
                      </button>
                    </div>

                    {smtpSuccess && <p className="text-[10px] text-emerald-500 font-medium leading-normal mt-1">{smtpSuccess}</p>}
                    {smtpError && <p className="text-[10px] text-red-500 font-medium leading-normal mt-1">{smtpError}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* POPUP 1: OAuth Mock Sign in modal */}
        {authMockOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 dark:bg-black/80" onClick={() => setAuthMockOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm border border-zinc-150 dark:border-zinc-800 overflow-hidden relative z-10 p-6 space-y-4 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 inline-block">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Xác thực Google Workspace</h3>
                <p className="text-xs text-zinc-400">Kết nối Google Account của Quản trị viên để tự động gửi Email nạp hóa đơn và chép dữ liệu Excel.</p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => handleMockAuthenticate('demo')}
                  className="w-full py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Dùng phiên Demo cực đơn giản</span>
                </button>

                <div className="text-center">
                  <span className="text-[10px] text-zinc-400">Chạy demo không cần cấu hình Google API rườm rà!</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* POPUP 2: Rich Email Receipt preview */}
        {selectedOrderEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 dark:bg-black/80" onClick={() => setSelectedOrderEmail(null)} />
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-zinc-100 dark:bg-zinc-950 rounded-2xl w-full max-w-2xl border border-zinc-250 dark:border-zinc-800 overflow-hidden relative z-10 flex flex-col h-[85vh] shadow-2xl"
            >
              <div className="bg-zinc-800 text-white px-5 py-3.5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-400" />
                  <span className="font-semibold text-xs font-mono">Bản xem trước Email xác nhận gửi khách hàng</span>
                </div>
                <button
                  onClick={() => setSelectedOrderEmail(null)}
                  className="p-1 hover:bg-white/10 rounded cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 shrink-0 font-mono space-y-1">
                <div>From: <strong>Son Store</strong> &lt;admin.sonstore@gmail.com&gt;</div>
                <div>To: <strong>{selectedOrderEmail.customer.name}</strong> &lt;{selectedOrderEmail.customer.email}&gt;</div>
                <div>Subject: <strong className="text-zinc-200">[Son Store] Xác nhận đơn hàng thành công #{selectedOrderEmail.id}</strong></div>
              </div>

              {/* Email Content Container */}
              <div className="flex-1 overflow-y-auto p-6 bg-zinc-200">
                <div className="mx-auto max-w-[600px] bg-white text-zinc-800 p-8 rounded-lg shadow-sm font-sans">
                  {/* Title */}
                  <div className="text-center border-b border-zinc-900 pb-4 mb-5">
                    <h1 className="text-xl font-bold tracking-widest text-zinc-950">SON STORE</h1>
                    <p className="text-[11px] text-zinc-400 font-serif italic mt-1">Elevate Your Digital Life</p>
                  </div>

                  <p className="text-xs">Chào <strong>{selectedOrderEmail.customer.name}</strong>,</p>
                  <p className="text-xs mt-2 leading-relaxed">
                    Chúng tôi xin thông báo đơn hàng mã <strong className="font-semibold font-mono">#{selectedOrderEmail.id}</strong> của bạn đã được xác nhận thanh toán thành công và đang chuẩn bị giao đến địa chỉ của bạn.
                  </p>

                  <div className="bg-zinc-50 p-4 rounded-lg my-4 space-y-3">
                    <h3 className="text-xs font-bold border-b border-zinc-200 pb-1.5 text-zinc-900 uppercase tracking-wider">Chi Tiết Đơn Hàng</h3>
                    
                    <div className="divide-y divide-zinc-200/80">
                      {selectedOrderEmail.items.map((item, id) => (
                        <div key={id} className="flex justify-between items-center text-[11px] py-1.5">
                          <span className="text-zinc-700">{item.name}</span>
                          <span className="text-zinc-500 font-mono">x{item.quantity}</span>
                          <span className="font-semibold text-zinc-900 font-mono">{formatVND(item.price)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-right text-xs font-bold pt-3 border-t border-zinc-200 text-zinc-950 flex justify-between items-center block">
                      <span>TỔNG THANH TOÁN:</span>
                      <span className="font-mono text-sm font-bold text-emerald-600">{formatVND(selectedOrderEmail.total)}</span>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-lg font-sans text-[11px] space-y-1 leading-relaxed">
                    <div className="font-bold text-amber-800">📍 THÔNG TIN ĐÓN NHẬN HÀNG:</div>
                    <div>• <strong>Người nhận:</strong> {selectedOrderEmail.customer.name}</div>
                    <div>• <strong>Điện thoại:</strong> {selectedOrderEmail.customer.phone}</div>
                    <div>• <strong>Địa chỉ giao:</strong> {selectedOrderEmail.customer.address}</div>
                    {selectedOrderEmail.customer.note ? <div>• <strong>Ghi chú:</strong> {selectedOrderEmail.customer.note}</div> : null}
                  </div>

                  <p className="text-[11px] text-zinc-500 leading-relaxed mt-4">
                    Mọi thắc mắc về quá trình đóng gói và vận chuyển, vui lòng trả lời trực tiếp email này hoặc qua đường dây nóng chăm sóc: <strong className="text-zinc-900 text-semibold">090 123 4567</strong>.
                  </p>

                  <div className="text-center pt-6 mt-6 border-t border-zinc-100 text-[10px] text-zinc-400">
                    <p>Son Store - Hệ thống bán lẻ thiết bị công nghệ cao, tối giản & sang trọng.</p>
                    <p className="mt-1 font-light">Cảm ơn quý khách đã tin cậy!</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}
