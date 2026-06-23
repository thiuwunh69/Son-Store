import { Product } from '../types';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface ProductCardProps {
  key?: any;
  product: Product;
  onAddToCart: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const formattedPrice = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(product.price);

  const isOutOfStock = product.quantity <= 0;

  return (
    <motion.div
      id={`product-card-${product.id}`}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-none border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 p-4 transition-all duration-300 hover:border-[#D4AF37]/60 dark:hover:border-[#D4AF37]/80 hover:shadow-md dark:hover:shadow-none"
    >
      {/* Target image with hover zoom */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-black/45 border border-zinc-100 dark:border-white/5">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90 group-hover:opacity-100 dark:opacity-85"
          loading="lazy"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 dark:bg-black/80 backdrop-blur-xs">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white px-3 py-1.5 border border-[#D4AF37]/40 rounded-none bg-black/85">
              HẾT HÀNG
            </span>
          </div>
        )}
        {!isOutOfStock && product.quantity <= 5 && (
          <div className="absolute top-2 left-2 bg-[#D4AF37]/95 text-black text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-none shadow-xs">
            Chỉ còn {product.quantity}
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="mt-4 flex flex-1 flex-col justify-between">
        <div>
          <span className="text-[9px] font-mono tracking-[0.2em] text-[#D4AF37] dark:text-[#D4AF37]/90 uppercase block font-semibold">
            {product.category}
          </span>
          <h3 className="mt-1 text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white line-clamp-1 group-hover:text-[#D4AF37] transition-colors leading-tight">
            {product.name}
          </h3>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-white/50 line-clamp-2 leading-relaxed flex-1 italic">
            {product.description}
          </p>
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-150 dark:border-white/10 flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-[#D4AF37] dark:text-[#D4AF37]/90">
            {formattedPrice}
          </span>

          <button
            id={`btn-add-to-cart-${product.id}`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
            disabled={isOutOfStock}
            className={`flex items-center gap-1 pb-1 text-[10px] uppercase font-bold tracking-widest transition-all ${
              isOutOfStock
                ? 'text-zinc-300 dark:text-white/20 cursor-not-allowed border-none'
                : 'text-zinc-700 hover:text-[#D4AF37] dark:text-white/80 dark:hover:text-[#D4AF37] border-b border-zinc-300 hover:border-[#D4AF37] dark:border-white/25 dark:hover:border-[#D4AF37] active:scale-95 cursor-pointer'
            }`}
          >
            <Plus className="h-3 w-3 inline-block" />
            <span>Thêm</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

