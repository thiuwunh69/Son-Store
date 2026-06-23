import React, { useState, useEffect } from 'react';
import { Product, CartItem, AdminStatus } from './types';
import ThemeToggle from './components/ThemeToggle';
import { safeLocalStorage, safeSessionStorage } from './utils/storage';
import { apiFetch } from './utils/mockApi';
import ProductCard from './components/ProductCard';
import CartDrawer from './components/CartDrawer';
import AdminPanel from './components/AdminPanel';
import { 
  ShoppingCart, ShieldCheck, Search, SlidersHorizontal, 
  Sparkles, Check, ChevronRight, Settings, ExternalLink, HelpCircle,
  RefreshCw, Lock, User, AlertCircle, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Check local storage or default to true for premium dark feel
    const savedTheme = safeLocalStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // UI state
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [adminView, setAdminView] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    const isRemembered = safeLocalStorage.getItem('isAdminAuthRemember') === 'true';
    const isSessionAuth = safeSessionStorage.getItem('isAdminAuth') === 'true';
    return isRemembered || isSessionAuth;
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && (password === 'admin123' || password === 'sonstore' || password === 'sonstore2026')) {
      setIsAdminAuthenticated(true);
      safeSessionStorage.setItem('isAdminAuth', 'true');
      if (rememberMe) {
        safeLocalStorage.setItem('isAdminAuthRemember', 'true');
      } else {
        safeLocalStorage.removeItem('isAdminAuthRemember');
      }
      setLoginError('');
    } else {
      setLoginError('Thương hiệu từ chối: Sai tên đăng nhập hoặc mật khẩu!');
    }
  };
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');

  // Sync dark mode HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      safeLocalStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      safeLocalStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Fetch products and admin status
  const fetchProductsAndStatus = async () => {
    setIsLoading(true);
    try {
      // Parallel loading
      const [prodRes, statusRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/admin/status')
      ]);

      if (prodRes.ok) {
        setProducts(await prodRes.json());
      }
      if (statusRes.ok) {
        setAdminStatus(await statusRes.json());
      }
    } catch (error) {
      console.error('Error fetching storefront data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndStatus();
    
    // Load local cart if saved
    const savedCart = safeLocalStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Sync cart to local storage
  const syncCart = (newCart: CartItem[]) => {
    setCart(newCart);
    safeLocalStorage.setItem('cart', JSON.stringify(newCart));
  };

  // Cart operations
  const handleAddToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    
    if (existingIndex !== -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.quantity) {
        alert(`Rất tiếc! Cửa hàng hiện tại chỉ còn ${product.quantity} sản phẩm này.`);
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      syncCart(newCart);
    } else {
      syncCart([...cart, { product, quantity: 1 }]);
    }
    
    // Quick pop drawer on item added
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    
    // Check database stock limit
    const product = products.find(p => p.id === productId);
    if (product && quantity > product.quantity) {
      alert(`Trong kho chỉ có tối đa ${product.quantity} sản phẩm.`);
      return;
    }

    const newCart = cart.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    );
    syncCart(newCart);
  };

  const handleRemoveItem = (productId: string) => {
    const newCart = cart.filter(item => item.product.id !== productId);
    syncCart(newCart);
  };

  const handleClearCart = () => {
    syncCart([]);
  };

  // Filter products list
  const categoriesList = ['Tất cả', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(product => {
    const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'Tất cả' || product.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const cartTotalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // If Admin panel toggle is active
  if (adminView) {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#D4AF37] selection:text-black">
          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-md bg-white/5 border border-white/10 p-8 flex flex-col justify-between rounded-none shadow-2xl relative overflow-hidden"
          >
            {/* Top gold line accent */}
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>

            {/* Logo and Headings */}
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-none mb-4 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <Lock className="h-6 w-6 animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold tracking-[0.2em] text-white serif uppercase">SON STORE</h1>
              <span className="text-[10px] tracking-[0.4em] uppercase text-[#D4AF37] opacity-90 block mt-2 font-medium">Bảo mật hệ thống Quản trị</span>
              <p className="text-xs text-white/50 mt-4 leading-relaxed">
                Chào mừng Quản trị viên. Vui lòng xác thực tài khoản để tiếp tục truy cập trang đối soát và quản lý hệ thống.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-950/45 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-5">
              {/* Username Input */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] uppercase text-white/40 tracking-[0.2em] font-semibold text-left">Tên đăng nhập</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30" />
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-xs focus:border-[#D4AF37] outline-none rounded-none text-white transition-all focus:ring-1 focus:ring-[#D4AF37]/20 placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] uppercase text-white/40 tracking-[0.2em] font-semibold text-left">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30" />
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-xs focus:border-[#D4AF37] outline-none rounded-none text-white transition-all focus:ring-1 focus:ring-[#D4AF37]/20 placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Remember device checkbox */}
              <div className="flex items-center gap-2 py-1 select-none">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-none border-white/20 bg-white/5 text-[#D4AF37] focus:ring-[#D4AF37]/50 h-3.5 w-3.5 cursor-pointer accent-[#D4AF37]"
                />
                <label htmlFor="rememberMe" className="text-[10px] text-white/50 tracking-wider uppercase cursor-pointer">
                  Ghi nhớ thiết bị (Không hỏi lại)
                </label>
              </div>

              {/* Tips credentials label */}
              <div className="p-3 bg-white/5 border border-white/5 text-[10px] text-white/40 space-y-1 rounded-none">
                <p className="font-mono text-center">Tài khoản mặc định:</p>
                <div className="flex justify-center gap-x-4 font-mono text-white/60">
                  <span>User: <strong className="text-[#D4AF37]">admin</strong></span>
                  <span>Pass: <strong className="text-[#D4AF37]">admin123</strong></span>
                </div>
              </div>

              {/* Buttons and actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-[#D4AF37] py-3.5 text-xs font-bold uppercase tracking-[0.2em] rounded-none transition-all duration-300 shadow-lg cursor-pointer hover:shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:text-black"
                >
                  Xác nhận truy cập
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminView(false);
                    setLoginError('');
                    setUsername('');
                    setPassword('');
                  }}
                  className="w-full bg-transparent text-white/60 hover:text-white border border-white/10 hover:border-white/30 py-3 text-xs font-bold uppercase tracking-[0.2em] rounded-none transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Quay lại Cửa hàng
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      );
    }

    return (
      <div className={darkMode ? 'dark bg-zinc-950 text-zinc-50' : 'bg-zinc-50 text-zinc-900'}>
        <AdminPanel
          onBack={() => {
            setAdminView(false);
            const isRemembered = safeLocalStorage.getItem('isAdminAuthRemember') === 'true';
            if (!isRemembered) {
              setIsAdminAuthenticated(false);
              safeSessionStorage.removeItem('isAdminAuth');
            }
            fetchProductsAndStatus(); // reload stock or settings changes
          }}
          adminStatus={adminStatus}
          onRefreshStatus={async () => {
            const statusRes = await apiFetch('/api/admin/status');
            if (statusRes.ok) setAdminStatus(await statusRes.json());
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${darkMode ? 'dark bg-zinc-950 text-zinc-50' : 'bg-zinc-50 text-zinc-900'} min-h-screen transition-colors duration-300 flex flex-col justify-between selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900`}>
      
      {/* Top Header navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/15">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-xl font-bold tracking-widest text-zinc-950 dark:text-white">SON STORE</span>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 tracking-wider hidden sm:block">
                CÔNG NGHỆ TỐI GIẢN • ĐẲNG CẤP XỨNG TẦM
              </p>
            </div>
          </div>

          {/* Action buttons (Cart, Admin view, Dark mode toggle) */}
          <div className="flex items-center gap-3">
            
            {/* Quick Go-to-Admin Portal */}
            <button
              id="admin-dashboard-btn"
              onClick={() => setAdminView(true)}
              className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              title="Admin Dashboard"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Dark & Light toggle */}
            <ThemeToggle darkMode={darkMode} onToggle={() => setDarkMode(!darkMode)} />

            {/* Shopping Cart button */}
            <button
              id="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-full border border-zinc-200 dark:border-zinc-850 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartTotalItems > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-emerald-500 text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center ring-2 ring-white dark:ring-zinc-950 animate-bounce"
                >
                  {cartTotalItems}
                </motion.span>
              )}
            </button>

          </div>
        </div>
      </header>

      {/* Hero Banner Intro */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-10 max-w-7xl mx-auto w-full">
        <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900 p-8 sm:p-12 shadow-sm text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4 max-w-2xl mx-auto"
          >
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100 dark:bg-zinc-850 px-3 py-1 rounded-full text-center inline-block">
              Premium Digital Boutique
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-tight font-sans">
              Công Nghệ Tối Giản, Đẳng Cấp Xứng Tầm
            </h2>
            <p style={{ color: darkMode ? '#ffffff' : '#3f3f46' }} className="text-sm font-light leading-relaxed">
              Chào mừng tới <strong className={`font-medium ${darkMode ? 'text-white' : 'text-zinc-950'}`}>Son Store</strong> — Điểm đến mua sắm thiết bị Apple, tai nghe Hi-Fi, bàn phím cơ custom & phụ kiện setup tối giản cao cấp hàng đầu Việt Nam.
            </p>

            <div className="pt-2 flex items-center justify-center gap-6 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Số dư Excel đồng bộ</span>
              </div>
              <p>•</p>
              <div className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Thanh toán VietQR tiện lợi</span>
              </div>
              <p>•</p>
              <div className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Không cần đăng nhập</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Browse Catalog Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16 space-y-8">
        
        {/* Search Bar & Categorizations Filters Block */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 py-4 border-b border-zinc-200 dark:border-zinc-900">
          {/* Multi category tags list */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0 max-w-full">
            {categoriesList.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === category
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Search box input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Bạn muốn tìm gì hôm nay?..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 focus:border-zinc-950 dark:focus:border-white focus:outline-none transition-all text-zinc-900 dark:text-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Catalog display board */}
        {isLoading ? (
          <div className="py-24 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-zinc-400" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">Đang khởi tạo danh muc hàng công nghệ cao cấp...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-32 text-center text-zinc-400 dark:text-zinc-500">
            <SlidersHorizontal className="h-10 w-10 mx-auto mb-4 text-zinc-300" />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">Không tìm thấy sản phẩm kỹ thuật phù hợp!</p>
            <p className="text-xs mt-1">Hãy thử tìm từ khóa khác hoặc quay lại danh mục tất cả.</p>
          </div>
        ) : (
          <motion.div 
            layout 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

      </main>

      {/* Sliding Checkout cart panel */}
      <AnimatePresence>
        {isCartOpen && (
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cartItems={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            adminStatus={adminStatus}
          />
        )}
      </AnimatePresence>

      {/* Footer bar */}
      <footer className="border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 py-10 transition-colors shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left space-y-1">
            <h4 className="font-sans text-sm font-bold tracking-wider text-zinc-900 dark:text-white">SON STORE</h4>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-light">© 2026 Son Store Digital Tech. All rights reserved.</p>
          </div>

          <div className="flex gap-4 items-center text-[11px] text-zinc-400 dark:text-zinc-500">
            <button
              onClick={() => setAdminView(true)}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Đối soát đơn hàng Admin</span>
            </button>
            <p>•</p>
            <a
              href="https://vietqr.net" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Tiêu chuẩn VietQR</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
