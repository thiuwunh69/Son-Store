import { useState, useEffect } from 'react';
import { CartItem, Customer, AdminStatus } from '../types';
import { apiFetch } from '../utils/mockApi';
import { 
  X, Plus, Minus, Trash2, ArrowRight, ArrowLeft, QrCode, 
  CheckCircle2, AlertCircle, Copy, Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  adminStatus: AdminStatus | null;
}

type CheckoutStep = 'review' | 'details' | 'payment' | 'success';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  adminStatus
}: CartDrawerProps) {
  const [step, setStep] = useState<CheckoutStep>('review');
  const [copied, setCopied] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Form Fields
  const [customer, setCustomer] = useState<Customer>({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: ''
  });

  // Keep track of a dummy transfer info or order ID before placing order
  const [tempOrderId, setTempOrderId] = useState('');

  useEffect(() => {
    if (isOpen && step === 'review') {
      // Re-generate a temporary ID to pre-populate Transfer comments
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      setTempOrderId(`SON-${randomCode}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const total = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const formattedTotal = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(total);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const validateForm = () => {
    if (!customer.name.trim()) return 'Vui lòng nhập họ tên.';
    if (!customer.phone.trim()) return 'Vui lòng nhập số điện thoại.';
    if (!customer.email.trim() || !customer.email.includes('@')) return 'Vui lòng nhập email hợp lệ.';
    if (!customer.address.trim()) return 'Vui lòng nhập địa chỉ giao hàng.';
    return '';
  };

  const handleNextToPayment = () => {
    const error = validateForm();
    if (error) {
      setErrorMsg(error);
      return;
    }
    setErrorMsg('');
    setStep('payment');
  };

  const handleConfirmPurchase = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer,
          items: cartItems.map(item => ({
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity
          })),
          total,
          paymentMethod: 'WireTransfer'
        })
      });

      if (!response.ok) {
        throw new Error('Không thể ghi nhận đơn hàng lên hệ thống. Vui lòng thử lại.');
      }

      const orderData = await response.json();
      setPlacedOrder(orderData);
      onClearCart();
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // VietQR Config defaults or admin config overrides
  const bankName = adminStatus?.config?.bankName || 'MB Bank';
  const bankAccount = adminStatus?.config?.bankAccount || '19028468888';
  const bankAccountName = adminStatus?.config?.bankAccountName || 'NGUYEN HOANG SON';
  
  // Format bank ID for QR (MB -> MB, Techcombank -> TCB, Vietcombank -> VCB, etc.)
  let qrBankId = bankName.split(' ')[0].toUpperCase();
  if (qrBankId === 'MB') qrBankId = 'MB'; // VietQR code for Military Bank

  // Dynamic QR API from VietQR
  const transferMessage = `SON STORE CK DON ${tempOrderId}`;
  const qrCodeUrl = `https://img.vietqr.io/image/${qrBankId}-${bankAccount}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(transferMessage)}&accountName=${encodeURIComponent(bankAccountName)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs transition-opacity"
      />

      {/* Slide Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-screen max-w-md bg-white dark:bg-[#0a0a0a] text-zinc-800 dark:text-[#e5e5e5] shadow-2xl flex flex-col h-full border-l border-zinc-200 dark:border-white/10"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between bg-zinc-50 dark:bg-white/5">
            <div>
              <h2 className="text-base font-bold uppercase tracking-widest text-[#D4AF37]">
                {step === 'review' && 'Giỏ hàng của bạn'}
                {step === 'details' && 'Thông tin đặt hàng'}
                {step === 'payment' && 'Quét mã chuyển khoản'}
                {step === 'success' && 'Đặt hàng thành công'}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-white/40 mt-1">
                {step === 'review' && `Có ${cartItems.length} sản phẩm`}
                {step === 'details' && 'Không cần tạo mật khẩu'}
                {step === 'payment' && 'Xác nhận tự động sau chuyển khoản'}
                {step === 'success' && 'Đơn hàng của bạn đã ghi nhận'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-none border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-white/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 cursor-pointer transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 flex gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Content Space */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Review items in Cart */}
              {step === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4 h-full flex flex-col justify-between"
                >
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center h-full">
                      <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-700">
                        <Trash2 className="h-8 w-8" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">Giỏ hàng của bạn đang trống</p>
                      <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500 max-w-xs">Hãy dạo quanh cửa hàng và chọn những sản phẩm công nghệ bạn yêu thích!</p>
                      <button
                        onClick={onClose}
                        className="mt-6 px-4 py-2 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:shadow-lg dark:hover:shadow-none cursor-pointer"
                      >
                        Tiếp tục mua sắm
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {cartItems.map(item => (
                        <div
                          key={item.product.id}
                          className="flex gap-4 p-3 bg-zinc-50 dark:bg-white/5 border border-zinc-150 dark:border-white/10 rounded-none shadow-sm dark:shadow-none"
                        >
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            referrerPolicy="no-referrer"
                            className="h-16 w-16 rounded-none object-cover bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-white/5 shrink-0"
                          />
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-white line-clamp-1">{item.product.name}</h4>
                              <p className="text-xs font-mono font-semibold text-[#D4AF37] mt-0.5">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.product.price)}
                              </p>
                            </div>

                            {/* Quantity selection */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-150 dark:border-white/5">
                              <div className="flex items-center gap-2 border border-zinc-200 dark:border-white/15 rounded-none px-2 bg-zinc-100 dark:bg-white/5 text-zinc-800 dark:text-[#e5e5e5]">
                                <button
                                  onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                  className="p-1 hover:text-[#D4AF37] transition-colors cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="font-mono text-xs w-4 text-center font-bold text-zinc-950 dark:text-white">{item.quantity}</span>
                                <button
                                  onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                  className="p-1 hover:text-[#D4AF37] transition-colors cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              <button
                                onClick={() => onRemoveItem(item.product.id)}
                                className="p-1 text-zinc-400 dark:text-white/40 hover:text-red-500 rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {step === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  className="space-y-4"
                >
                  <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-150 dark:border-white/10 rounded-none p-4 space-y-4 shadow-none">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]/90 mb-1.5">Họ và tên khách hàng *</label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn A"
                        value={customer.name}
                        onChange={e => setCustomer({ ...customer, name: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-3 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 outline-none rounded-none text-zinc-900 dark:text-white font-sans transition-all placeholder:text-zinc-400 dark:placeholder:text-white/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]/90 mb-1.5">Số điện thoại liên hệ *</label>
                      <input
                        type="tel"
                        placeholder="09xx xxx xxx"
                        value={customer.phone}
                        onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-3 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 outline-none rounded-none text-zinc-900 dark:text-white font-sans transition-all placeholder:text-zinc-400 dark:placeholder:text-white/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]/90 mb-1.5">Địa chỉ Email nhận hóa đơn *</label>
                      <input
                        type="email"
                        placeholder="nguyenvana@gmail.com"
                        value={customer.email}
                        onChange={e => setCustomer({ ...customer, email: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-3 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 outline-none rounded-none text-zinc-900 dark:text-white font-sans transition-all placeholder:text-zinc-400 dark:placeholder:text-white/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]/90 mb-1.5">Địa chỉ giao hàng đầy đủ *</label>
                      <textarea
                        rows={3}
                        placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành Phố"
                        value={customer.address}
                        onChange={e => setCustomer({ ...customer, address: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-3 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 outline-none rounded-none text-zinc-900 dark:text-white font-sans transition-all resize-none placeholder:text-zinc-400 dark:placeholder:text-white/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]/90 mb-1.5">Ghi chú giao hàng (nếu có)</label>
                      <textarea
                        rows={2}
                        placeholder="Ví dụ: Giao giờ hành chính, gọi điện trước khi giao..."
                        value={customer.note}
                        onChange={e => setCustomer({ ...customer, note: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-4 py-3 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 outline-none rounded-none text-zinc-900 dark:text-white font-sans transition-all resize-none placeholder:text-zinc-400 dark:placeholder:text-white/20"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Wire Transfer QR Code Checkout */}
              {step === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-150 dark:border-white/10 rounded-none p-5 shadow-none space-y-4">
                    {/* QR Code Container */}
                    <div className="flex flex-col items-center text-center">
                      <div className="relative p-2 bg-white border border-zinc-200 dark:border-white/10 rounded-none shadow-sm">
                        {/* Beautiful QR Code mockup */}
                        <img
                          src={qrCodeUrl}
                          alt="Bank Transfer QR Code"
                          className="h-52 w-52 object-contain"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 dark:text-white/40 mt-3 max-w-xs leading-relaxed uppercase tracking-wider">
                        Mở ứng dụng ngân hàng bất kỳ quét mã QR trên để tự điền thông tin chuyển khoản chính xác nhất.
                      </p>
                    </div>

                    {/* Manual Bank Info Table */}
                    <div className="border-t border-zinc-200 dark:border-white/10 pt-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 uppercase tracking-wider">Ngân hàng</span>
                        <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                          <span>{bankName}</span>
                          <button
                            onClick={() => handleCopy(bankName, 'bankName')}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"
                          >
                            {copied === 'bankName' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 uppercase tracking-wider">Số tài khoản</span>
                        <div className="flex items-center gap-1.5 font-mono font-medium text-zinc-900 dark:text-white">
                          <span>{bankAccount}</span>
                          <button
                            onClick={() => handleCopy(bankAccount, 'bankAccount')}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"
                          >
                            {copied === 'bankAccount' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 uppercase tracking-wider">Chủ tài khoản</span>
                        <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                          <span>{bankAccountName}</span>
                          <button
                            onClick={() => handleCopy(bankAccountName, 'bankAccountName')}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"
                          >
                            {copied === 'bankAccountName' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 uppercase tracking-wider">Số tiền chuyển</span>
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-[#D4AF37]">
                          <span>{formattedTotal}</span>
                          <button
                            onClick={() => handleCopy(String(total), 'amount')}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"
                          >
                            {copied === 'amount' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 uppercase tracking-wider">Nội dung CK</span>
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-[#D4AF37]">
                          <span>{transferMessage}</span>
                          <button
                            onClick={() => handleCopy(transferMessage, 'message')}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"
                          >
                            {copied === 'message' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-none border border-[#D4AF37]/35 bg-[#D4AF37]/10 p-4 flex gap-3 text-xs text-zinc-700 dark:text-[#e5e5e5]">
                    <AlertCircle className="h-5 w-5 shrink-0 text-[#D4AF37]" />
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-[#D4AF37]">Lưu ý cực kỳ quan trọng:</p>
                      <p className="mt-1 font-light leading-relaxed text-zinc-600 dark:text-white/75">
                        Hãy đảm bảo sao chép và nhập chính xác <strong className="font-semibold text-zinc-950 dark:text-white">Nội dung CK</strong> bên trên để hệ thống tự động nhận diện đơn hàng thanh toán của bạn!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Placed Order Success Screen */}
              {step === 'success' && placedOrder && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 text-center py-6"
                >
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-950 rounded-full text-emerald-500 dark:text-emerald-400 mb-4 animate-bounce">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Đặt hàng thành công!</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                      Cảm ơn bạn đã lựa chọn mua sắm cùng Son Store.
                    </p>
                  </div>

                  {/* Summary order */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 rounded-2xl p-4 text-left space-y-3 shadow-xs">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-400 dark:text-zinc-500">Mã đơn hàng</span>
                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-100">{placedOrder.id}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-400 dark:text-zinc-500">Khách hàng</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{placedOrder.customer?.name}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-400 dark:text-zinc-500">Email</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{placedOrder.customer?.email}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400 dark:text-zinc-500">Sản phẩm mua</span>
                      <div className="text-right flex-1 ml-4 text-zinc-800 dark:text-zinc-200 space-y-1 line-clamp-1 truncate">
                        {placedOrder.items?.map((item: any) => (
                          <div key={item.id} className="text-xs">
                            {item.name} <span className="text-zinc-400 font-mono">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-400 dark:text-zinc-500">Tổng đã thành toán</span>
                      <span className="font-mono font-bold text-zinc-950 dark:text-white">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(placedOrder.total)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-900 text-xs text-zinc-500 dark:text-zinc-400 text-left leading-relaxed">
                    🌟 <strong>Quy trình tiếp theo:</strong>
                    <ol className="list-decimal ml-4 mt-2 space-y-1.5 font-light">
                      <li>Hệ thống lưu giữ thông tin mua hàng vào tệp <strong>Google Sheets</strong>.</li>
                      <li>Admin đối soát khoản chuyển khoản tương ứng với mã <strong>{placedOrder.id}</strong>.</li>
                      <li>Sau khi xác nhận số dư, một email hóa đơn điện tử sẽ tự động gửi tới hòm thư <strong>{placedOrder.customer?.email}</strong>.</li>
                    </ol>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:shadow-lg dark:hover:shadow-none transition-shadow cursor-pointer"
                  >
                    Quay về trang chủ
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer - Order Button and Summary (Only for Steps 1, 2, 3) */}
          {step !== 'success' && cartItems.length > 0 && (
            <div className="px-6 py-5 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between font-mono text-sm mb-4">
                <span className="text-zinc-500 dark:text-zinc-400">Thành tiền</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{formattedTotal}</span>
              </div>

              {step === 'review' && (
                <button
                  id="checkout-btn-review"
                  onClick={() => setStep('details')}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:shadow-xl dark:hover:shadow-none transition-all active:scale-98 cursor-pointer"
                >
                  <span>Tiếp tục đặt hàng</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {step === 'details' && (
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setStep('review')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs font-semibold active:scale-98 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={handleNextToPayment}
                    className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:shadow-xl dark:hover:shadow-none transition-all active:scale-98 cursor-pointer"
                  >
                    <span>Lấy mã quét QR</span>
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>
              )}

              {step === 'payment' && (
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setStep('details')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs font-semibold active:scale-98 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    id="checkout-btn-payment"
                    onClick={handleConfirmPurchase}
                    disabled={isSubmitting}
                    className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-xs font-semibold hover:shadow-xl dark:hover:shadow-none transition-all active:scale-98 cursor-pointer"
                  >
                    <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận đã chuyển khoản'}</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
