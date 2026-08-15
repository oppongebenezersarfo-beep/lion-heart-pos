import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { productsAPI, salesAPI, authAPI, customersAPI, usersAPI, paymentsAPI } from '../../services/api';
import { cacheProducts, searchCachedProducts, cacheCustomers, searchCachedCustomers, cacheUsers, verifyPinOffline, holdSale, getHeldSales, deleteHeldSale, queueOfflineSale } from '../../db';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { formatCedis } from '../../utils/format';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  selling_price: number;
  quantity: number;
  discount: number;
  max_stock: number;
}

export default function Checkout() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: number }[]>([]);
  const [splitMethod, setSplitMethod] = useState('cash');
  const [splitAmount, setSplitAmount] = useState('');
  const [heldSales, setHeldSales] = useState<any[]>([]);
  const [showHeldSales, setShowHeldSales] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountItemId, setDiscountItemId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  // Paystack MoMo state
  const [momoPhone, setMomoPhone] = useState('');
  const [momoProvider, setMomoProvider] = useState('mtn');
  const [momoProcessing, setMomoProcessing] = useState(false);
  const [momoStatus, setMomoStatus] = useState('');
  const [momoReference, setMomoReference] = useState('');
  const [momoPaystackRef, setMomoPaystackRef] = useState('');
  const [momoNeedsOtp, setMomoNeedsOtp] = useState(false);
  const [momoOtp, setMomoOtp] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - totalDiscount;

  const isMoMoMethod = (method: string) => ['mtn_momo', 'telecel', 'airteltigo'].includes(method);

  const providerMap: Record<string, string> = {
    mtn_momo: 'mtn',
    telecel: 'vod',
    airteltigo: 'atl',
  };

  const initiateMoMoPayment = async () => {
    if (!momoPhone.trim()) {
      toast.error('Enter a valid mobile money number');
      return;
    }

    const phone = momoPhone.replace(/\s+/g, '');
    const provider = providerMap[paymentMethod] || 'mtn';

    if (!/^(024|025|026|027|028|050|053|054|055|056|057|058|020|059|052)\d{7}$/.test(phone)) {
      toast.error('Enter a valid Ghana mobile money number (e.g. 024XXXXXXX)');
      return;
    }

    setMomoProcessing(true);
    setMomoStatus('Sending payment prompt to your phone...');
    setMomoProvider(provider);

    try {
      const res = await paymentsAPI.initiate({
        email: selectedCustomer?.email || `${phone}@pos.lionheart.com`,
        amount: total,
        phone,
        provider,
      });

      const { reference, paystack_reference, status, display_text } = res.data;
      setMomoReference(reference);
      setMomoPaystackRef(paystack_reference || reference);
      setMomoStatus(display_text || 'Processing...');

      if (status === 'success') {
        clearInterval(pollRef.current!);
        setMomoStatus('Payment successful!');
        toast.success('Payment confirmed!');
        await completeSale();
      } else if (status === 'failed') {
        clearInterval(pollRef.current!);
        setMomoStatus('Payment failed or was cancelled.');
        toast.error('Payment was not completed.');
        setMomoProcessing(false);
      } else if (status === 'send_otp') {
        setMomoNeedsOtp(true);
        setMomoStatus(display_text || 'An OTP has been sent to your phone. Please enter it below.');
        setMomoProcessing(false);
      } else {
        pollPaymentStatus(reference);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to initiate payment. Please try again.';
      toast.error(msg);
      setMomoProcessing(false);
      setMomoStatus('');
    }
  };

  const submitMomoOtp = async () => {
    if (!momoOtp.trim()) {
      toast.error('Enter the OTP');
      return;
    }
    setMomoProcessing(true);
    setMomoNeedsOtp(false);
    setMomoStatus('Verifying OTP...');

    try {
      const res = await paymentsAPI.submitOtp({
        reference: momoPaystackRef,
        otp: momoOtp.trim(),
      });

      const { status, display_text } = res.data;
      setMomoStatus(display_text || 'Processing...');
      setMomoOtp('');

      if (status === 'success') {
        setMomoStatus('Payment successful!');
        toast.success('Payment confirmed!');
        await completeSale();
      } else if (status === 'failed') {
        setMomoStatus('Payment failed or was cancelled.');
        toast.error('Payment was not completed.');
        setMomoProcessing(false);
      } else {
        pollPaymentStatus(momoReference);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'OTP verification failed.';
      toast.error(msg);
      setMomoProcessing(false);
      setMomoNeedsOtp(true);
      setMomoStatus('OTP verification failed. Please try again.');
    }
  };

  const pollPaymentStatus = (reference: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await paymentsAPI.verify(reference);
        const { status, gateway_response, display_text } = res.data;

        if (status === 'success') {
          clearInterval(pollRef.current!);
          setMomoStatus('Payment successful!');
          toast.success('Payment confirmed!');
          await completeSale();
        } else if (status === 'failed') {
          clearInterval(pollRef.current!);
          setMomoStatus('Payment failed or was cancelled.');
          toast.error('Payment was not completed.');
          setMomoProcessing(false);
        } else {
          setMomoStatus(display_text || gateway_response || 'Waiting for payment confirmation...');
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 5000);
  };

  const completeSale = async () => {
    const saleData = {
      items: cart.map((item) => ({
        product_id: item.id, quantity: item.quantity, unit_price: item.selling_price,
        discount: item.discount, total: item.selling_price * item.quantity - item.discount,
        name: item.name,
      })),
      subtotal, discount_amount: totalDiscount, total,
      payment_method: paymentMethod, payment_details: { reference: momoReference, phone: momoPhone, provider: momoProvider },
      customer_id: selectedCustomer?.id || null,
    };

    try {
      if (isOnline) {
        const response = await salesAPI.create(saleData);
        setLastSale({ ...response.data, cashier_name: user?.fullName, items: saleData.items });
      } else {
        const queueId = await queueOfflineSale({
          ...saleData, cashier_id: user!.id, created_at: new Date(),
        });
        setLastSale({
          id: `offline-${queueId}`, invoice_number: `OFFLINE-${Date.now()}`,
          ...saleData, cashier_name: user?.fullName, created_at: new Date().toISOString(), status: 'queued',
        });
      }
      setShowPayment(false);
      setShowReceipt(true);
      setCart([]);
      setSelectedCustomer(null);
      setMomoPhone('');
      setMomoProcessing(false);
      setMomoStatus('');
      setMomoReference('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to complete sale');
    }
  };

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      let results: any[] = [];
      if (isOnline) {
        const response = await productsAPI.getAll({ search: query });
        results = response.data;
      } else {
        results = await searchCachedProducts(query);
      }
      setSearchResults(results.slice(0, 10));
    } catch {
      try {
        const results = await searchCachedProducts(query);
        setSearchResults(results.slice(0, 10));
      } catch (e) { console.error(e); }
    }
  }, [isOnline]);

  // Search customers
  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) { setCustomerResults([]); return; }
    try {
      if (isOnline) {
        const response = await customersAPI.getAll({ search: query });
        setCustomerResults(response.data.slice(0, 5));
      } else {
        const results = await searchCachedCustomers(query);
        setCustomerResults(results.slice(0, 5));
      }
    } catch {
      try {
        const results = await searchCachedCustomers(query);
        setCustomerResults(results.slice(0, 5));
      } catch { console.error('Customer search failed'); }
    }
  }, [isOnline]);

  // Handle barcode scan input
  const handleBarcodeInput = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    try {
      let product = null;
      if (isOnline) {
        const response = await productsAPI.getByBarcode(barcode);
        product = response.data;
      } else {
        const { db } = await import('../../db');
        product = await db.products.where('barcode').equals(barcode).first();
      }
      if (product) {
        addToCart(product);
        setSearchQuery('');
        setSearchResults([]);
        toast.success(`Added: ${product.name}`);
      } else {
        toast.error('Product not found');
      }
    } catch { toast.error('Product not found'); }
  }, [isOnline]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length === 1) {
        addToCart(searchResults[0]);
        setSearchQuery('');
        setSearchResults([]);
      } else if (searchQuery.length >= 3) {
        handleBarcodeInput(searchQuery);
      }
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          toast.error('Insufficient stock');
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        id: product.id, name: product.name, sku: product.sku,
        unit_of_measure: product.unit_of_measure, selling_price: product.selling_price,
        quantity: 1, discount: 0, max_stock: product.current_stock,
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.max_stock) { toast.error('Insufficient stock'); return item; }
      return { ...item, quantity: newQty };
    }));
  };

  const setCustomQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (qty > item.max_stock) { toast.error('Insufficient stock'); return item; }
      return { ...item, quantity: qty };
    }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const openDiscountModal = async (itemId: string) => {
    const pin = prompt('Enter manager PIN to apply discount:');
    if (!pin) return;
    try {
      if (isOnline) {
        await authAPI.verifyPin(pin, 'discount');
      } else {
        const valid = await verifyPinOffline(pin);
        if (!valid) throw new Error('Invalid PIN');
      }
      setDiscountItemId(itemId);
      setShowDiscountModal(true);
    } catch { toast.error('Invalid manager PIN'); }
  };

  const confirmDiscount = () => {
    if (!discountItemId) return;
    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) { toast.error('Invalid discount value'); return; }
    setCart((prev) => prev.map((item) => {
      if (item.id !== discountItemId) return item;
      let disc = discountType === 'percentage'
        ? (item.selling_price * item.quantity * value) / 100
        : value;
      disc = Math.min(disc, item.selling_price * item.quantity);
      return { ...item, discount: disc };
    }));
    setShowDiscountModal(false);
    setDiscountValue('');
    setDiscountItemId(null);
    toast.success('Discount applied');
  };

  const handleHoldSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    try {
      await holdSale({ items: cart, customer_id: selectedCustomer?.id || null }, user!.id);
      setCart([]);
      setSelectedCustomer(null);
      toast.success('Sale held');
      loadHeldSales();
    } catch { toast.error('Failed to hold sale'); }
  };

  const loadHeldSales = async () => {
    try { setHeldSales(await getHeldSales(user!.id)); } catch (e) { console.error(e); }
  };

  const resumeHeldSale = async (sale: any) => {
    try {
      setCart(sale.sale_data.items || []);
      if (sale.sale_data.customer_id) {
        try {
          const res = await customersAPI.getById(sale.sale_data.customer_id);
          setSelectedCustomer(res.data);
        } catch { setSelectedCustomer(null); }
      }
      await deleteHeldSale(sale.id);
      setShowHeldSales(false);
      loadHeldSales();
      toast.success('Sale resumed');
    } catch { toast.error('Failed to resume sale'); }
  };

  const processPayment = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }

    // Credit sale requires customer
    if (paymentMethod === 'credit' && !selectedCustomer) {
      toast.error('Credit sale requires a customer');
      return;
    }

    // Check credit limit
    if (paymentMethod === 'credit' && selectedCustomer) {
      if (!selectedCustomer.is_credit_approved) {
        toast.error('Customer is not approved for credit sales');
        return;
      }
      if (selectedCustomer.outstanding_balance + total > selectedCustomer.credit_limit) {
        toast.error(`Credit limit exceeded. Limit: ${formatCedis(selectedCustomer.credit_limit)}, Outstanding: ${formatCedis(selectedCustomer.outstanding_balance)}`);
        return;
      }
    }

    let paymentDetails: any = {};
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived);
      if (isNaN(received) || received < total) { toast.error('Insufficient cash received'); return; }
      paymentDetails = { cash_received: received, change: received - total };
    } else if (paymentMethod === 'split') {
      const splitTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(splitTotal - total) > 0.01) { toast.error('Split payments do not match total'); return; }
      paymentDetails = { splits: splitPayments };
    } else if (paymentMethod === 'credit') {
      paymentDetails = { credit_terms: selectedCustomer.credit_terms_days };
    }

    const saleData = {
      items: cart.map((item) => ({
        product_id: item.id, quantity: item.quantity, unit_price: item.selling_price,
        discount: item.discount, total: item.selling_price * item.quantity - item.discount,
        name: item.name, // Store name for receipt
      })),
      subtotal, discount_amount: totalDiscount, total,
      payment_method: paymentMethod, payment_details: paymentDetails,
      customer_id: selectedCustomer?.id || null,
    };

    try {
      if (isOnline) {
        const response = await salesAPI.create(saleData);
        setLastSale({ ...response.data, cashier_name: user?.fullName, items: saleData.items });
      } else {
        const queueId = await queueOfflineSale({
          ...saleData,
          cashier_id: user!.id,
          created_at: new Date(),
        });
        setLastSale({
          id: `offline-${queueId}`,
          invoice_number: `OFFLINE-${Date.now()}`,
          ...saleData,
          cashier_name: user?.fullName,
          created_at: new Date().toISOString(),
          status: 'queued',
        });
      }
      setShowPayment(false);
      setShowReceipt(true);
      setCart([]);
      setSelectedCustomer(null);
      setCashReceived('');
      setSplitPayments([]);
      toast.success(isOnline ? 'Sale completed!' : 'Sale queued offline');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process sale');
    }
  };

  const printReceipt = () => { window.print(); };

  useEffect(() => {
    const loadCache = async () => {
      if (isOnline) {
        try {
          const [prodRes, custRes, usersRes] = await Promise.all([
            productsAPI.getAll(),
            customersAPI.getAll(),
            usersAPI.getAll(),
          ]);
          await cacheProducts(prodRes.data);
          await cacheCustomers(custRes.data);
          await cacheUsers(usersRes.data);
        } catch (e) { console.error(e); }
      }
    };
    loadCache();
    loadHeldSales();
  }, [isOnline]);

  useEffect(() => { barcodeInputRef.current?.focus(); }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div className="flex gap-6 h-full">
      {/* Left side - Products & Cart */}
      <div className="flex-1 flex flex-col">
        {/* Search / Barcode input */}
        <div className="mb-4 relative">
          <input
            ref={barcodeInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchProducts(e.target.value); }}
            onKeyDown={handleSearchKeyDown}
            className="input-field py-3 text-lg"
            placeholder="Scan barcode or search product by name/SKU..."
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {searchResults.map((product) => (
                <button key={product.id} onClick={() => { addToCart(product); setSearchQuery(''); setSearchResults([]); toast.success(`Added: ${product.name}`); }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center justify-between border-b border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-400">{product.sku} | {product.unit_of_measure}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lion-gold">{formatCedis(product.selling_price)}</p>
                    <p className="text-xs text-gray-400">Stock: {product.current_stock}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => { loadHeldSales(); setShowHeldSales(true); }}
            className="btn-secondary">Held Sales ({heldSales.length})</button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-lg">Scan a barcode or search for products</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="card flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-400">{item.sku} | {formatCedis(item.selling_price)}/{item.unit_of_measure}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center hover:bg-gray-600">-</button>
                    <input type="number" value={item.quantity}
                      onChange={(e) => setCustomQuantity(item.id, parseFloat(e.target.value) || 0)}
                      className="w-20 text-center bg-gray-800 border border-gray-600 rounded px-2 py-1" min="0.01" step="0.01" />
                    <button onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center hover:bg-gray-600">+</button>
                  </div>
                  <div className="text-right w-28">
                    <p className="font-bold">{formatCedis(item.selling_price * item.quantity - item.discount)}</p>
                    {item.discount > 0 && <p className="text-xs text-green-400">-{formatCedis(item.discount)}</p>}
                  </div>
                  <button onClick={() => openDiscountModal(item.id)} className="text-gray-400 hover:text-yellow-400" title="Discount">%</button>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-400">X</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Customer + Summary */}
      <div className="w-96 flex flex-col">
        <div className="card flex-1 flex flex-col">
          {/* Customer Picker */}
          <div className="mb-4 relative">
            <label className="block text-sm text-gray-400 mb-1">Customer (optional - required for credit)</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-gray-800 p-2 rounded">
                <div>
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-400">{selectedCustomer.phone} | Balance: {formatCedis(selectedCustomer.outstanding_balance)}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-red-400 text-sm">X</button>
              </div>
            ) : (
              <>
                <input type="text" value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                  className="input-field" placeholder="Search customer by name/phone..." />
                {customerResults.length > 0 && (
                  <div className="absolute z-40 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                    {customerResults.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-700 text-sm border-b border-gray-700 last:border-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone || 'No phone'} | Credit: {c.is_credit_approved ? 'Approved' : 'N/A'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-3 mb-4">
            {selectedCustomer && (
              <div className="flex justify-between text-gray-400 text-sm">
                <span>Customer: {selectedCustomer.name}</span>
                <span>Balance: <span className={selectedCustomer.outstanding_balance > 0 ? 'text-red-400 font-bold' : 'text-green-400'}>{formatCedis(selectedCustomer.outstanding_balance)}</span></span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Subtotal ({cart.length} items)</span>
              <span>{formatCedis(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount</span><span>-{formatCedis(totalDiscount)}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-3 flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-lion-gold">{formatCedis(total)}</span>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <button onClick={() => { if (cart.length > 0) { setPaymentMethod('cash'); setMomoPhone(''); setMomoProcessing(false); setMomoStatus(''); setMomoNeedsOtp(false); setMomoOtp(''); setMomoPaystackRef(''); setShowPayment(true); } }}
              disabled={cart.length === 0}
              className="btn-primary w-full py-4 text-lg">
              Pay {formatCedis(total)}
            </button>
            <button onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="btn-secondary w-full">
              Hold Sale
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Payment - {formatCedis(total)}</h2>

            {selectedCustomer && (
              <div className="bg-gray-800 p-2 rounded mb-4 text-sm">
                Customer: <span className="font-bold">{selectedCustomer.name}</span>
                {paymentMethod === 'credit' && (
                  <span className="ml-2 text-yellow-400">| Balance after: {formatCedis(selectedCustomer.outstanding_balance + total)}</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: 'cash', label: 'Cash' },
                { id: 'mtn_momo', label: 'MTN MoMo' },
                { id: 'telecel', label: 'Telecel' },
                { id: 'airteltigo', label: 'AirtelTigo' },
                { id: 'card', label: 'Card' },
                { id: 'credit', label: 'Credit (Pay Later)' },
                { id: 'split', label: 'Split Payment' },
              ].map((method) => (
                <button key={method.id} onClick={() => setPaymentMethod(method.id)}
                  className={`p-3 rounded-lg border text-center font-medium text-sm ${
                    paymentMethod === method.id ? 'border-lion-gold bg-lion-gold/20 text-lion-gold' : 'border-gray-600 hover:border-gray-500'
                  }`}>
                  {method.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'credit' && !selectedCustomer && (
              <p className="text-red-400 text-sm mb-4">Please select a customer first for credit sales.</p>
            )}

            {paymentMethod === 'cash' && (
              <div className="space-y-3 mb-4">
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)}
                  className="input-field text-lg" placeholder="Cash received" autoFocus />
                {cashReceived && parseFloat(cashReceived) >= total && (
                  <div className="text-green-400 text-lg font-bold">
                    Change: {formatCedis(parseFloat(cashReceived) - total)}
                  </div>
                )}
              </div>
            )}

            {(paymentMethod === 'mtn_momo' || paymentMethod === 'telecel' || paymentMethod === 'airteltigo') && !momoProcessing && !momoNeedsOtp && (
              <div className="space-y-3 mb-4">
                <input type="tel" value={momoPhone} onChange={(e) => setMomoPhone(e.target.value)}
                  className="input-field text-lg" placeholder="Mobile Money number (e.g. 024XXXXXXX)" autoFocus />
                {selectedCustomer?.phone && (
                  <button type="button"
                    onClick={() => { setMomoPhone(selectedCustomer.phone); toast.success('Customer number loaded'); }}
                    className="btn-secondary w-full text-sm">
                    Use Customer Number ({selectedCustomer.phone})
                  </button>
                )}
                <p className="text-xs text-gray-400">You will receive a prompt on your phone to enter your PIN.</p>
              </div>
            )}

            {(paymentMethod === 'mtn_momo' || paymentMethod === 'telecel' || paymentMethod === 'airteltigo') && momoNeedsOtp && (
              <div className="space-y-3 mb-4">
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 mb-2">
                  <p className="text-yellow-400 text-sm font-medium">Enter the OTP sent to your phone</p>
                  <p className="text-xs text-gray-400 mt-1">{momoStatus}</p>
                </div>
                <input type="text" value={momoOtp} onChange={(e) => setMomoOtp(e.target.value)}
                  className="input-field text-lg text-center tracking-widest" placeholder="Enter OTP" autoFocus maxLength={8} inputMode="numeric" />
                <button onClick={submitMomoOtp}
                  className="btn-success w-full py-3 text-lg">
                  Submit OTP
                </button>
              </div>
            )}

            {(paymentMethod === 'mtn_momo' || paymentMethod === 'telecel' || paymentMethod === 'airteltigo') && momoProcessing && (
              <div className="space-y-3 mb-4">
                <div className="text-center py-4">
                  <div className="animate-spin w-8 h-8 border-4 border-lion-gold border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-sm text-gray-300">{momoStatus}</p>
                  {momoReference && <p className="text-xs text-gray-500 mt-1">Ref: {momoReference}</p>}
                </div>
              </div>
            )}

            {paymentMethod === 'split' && (
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <select value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)} className="input-field">
                    <option value="cash">Cash</option>
                    <option value="mtn_momo">MTN MoMo</option>
                    <option value="telecel">Telecel</option>
                    <option value="airteltigo">AirtelTigo</option>
                    <option value="card">Card</option>
                  </select>
                  <input type="number" value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)}
                    className="input-field" placeholder="Amount" />
                  <button onClick={() => {
                    const amt = parseFloat(splitAmount);
                    if (amt > 0) { setSplitPayments([...splitPayments, { method: splitMethod, amount: amt }]); setSplitAmount(''); }
                  }} className="btn-primary">Add</button>
                </div>
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex justify-between bg-gray-800 p-2 rounded">
                    <span>{sp.method}</span>
                    <span>{formatCedis(sp.amount)}</span>
                    <button onClick={() => setSplitPayments(splitPayments.filter((_, j) => j !== i))}
                      className="text-red-400">X</button>
                  </div>
                ))}
                <div className="text-sm text-gray-400">
                  Remaining: {formatCedis(total - splitPayments.reduce((s, p) => s + p.amount, 0))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowPayment(false); setMomoProcessing(false); setMomoStatus(''); setMomoNeedsOtp(false); setMomoOtp(''); }}
                className="btn-secondary flex-1">Cancel</button>
              {!momoNeedsOtp && (
                <button onClick={() => {
                    if (paymentMethod === 'mtn_momo' || paymentMethod === 'telecel' || paymentMethod === 'airteltigo') { initiateMoMoPayment(); }
                    else { processPayment(); }
                  }}
                  disabled={(paymentMethod === 'credit' && !selectedCustomer) || momoProcessing || ((paymentMethod === 'mtn_momo' || paymentMethod === 'telecel' || paymentMethod === 'airteltigo') && !momoPhone.trim())}
                  className="btn-success flex-1 py-3">
                  {momoProcessing ? 'Processing...' : paymentMethod === 'credit' ? 'Confirm Credit Sale' : 'Confirm Payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Apply Discount</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setDiscountType('percentage')}
                  className={`flex-1 p-2 rounded border ${discountType === 'percentage' ? 'border-lion-gold bg-lion-gold/20' : 'border-gray-600'}`}>
                  Percentage %
                </button>
                <button onClick={() => setDiscountType('flat')}
                  className={`flex-1 p-2 rounded border ${discountType === 'flat' ? 'border-lion-gold bg-lion-gold/20' : 'border-gray-600'}`}>
                  Flat Amount
                </button>
              </div>
              <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                className="input-field" placeholder={discountType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 5.00 for GHS 5'} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setShowDiscountModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={confirmDiscount} className="btn-primary flex-1">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Held Sales Modal */}
      {showHeldSales && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Held Sales</h2>
            {heldSales.length === 0 ? (
              <p className="text-gray-400">No held sales</p>
            ) : (
              <div className="space-y-2">
                {heldSales.map((sale) => (
                  <div key={sale.id} className="card flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        {new Date(sale.created_at).toLocaleString()} | {sale.sale_data.items?.length || 0} items
                      </p>
                    </div>
                    <button onClick={() => resumeHeldSale(sale)} className="btn-primary text-sm">Resume</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowHeldSales(false)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-xl p-6 w-80 receipt-print">
            <div className="text-center mb-4">
              <h3 className="font-bold text-lg">LION HEART HARDWARE</h3>
              <p className="text-xs">Building Materials & Hardware</p>
              <p className="text-xs">Accra, Ghana</p>
            </div>
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <p className="text-xs">Invoice: {lastSale.invoice_number}</p>
            <p className="text-xs">Date: {new Date(lastSale.created_at).toLocaleString()}</p>
            <p className="text-xs">Cashier: {lastSale.cashier_name}</p>
            {lastSale.customer_id && <p className="text-xs">Customer: {selectedCustomer?.name || 'N/A'}</p>}
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="text-xs space-y-1">
              {lastSale.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{item.quantity}x {item.name || item.product_name || 'Item'}</span>
                  <span>{formatCedis(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{formatCedis(lastSale.total)}</span>
            </div>
            <p className="text-xs mt-1">Payment: {lastSale.payment_method === 'mtn_momo' ? 'MTN MoMo' : lastSale.payment_method === 'airteltigo' ? 'AirtelTigo' : lastSale.payment_method?.charAt(0).toUpperCase() + lastSale.payment_method?.slice(1)}</p>
            {lastSale.status === 'queued' && <p className="text-xs text-orange-600 font-bold mt-1">OFFLINE - Pending Sync</p>}
            <div className="text-center mt-4 text-xs">
              <p>Thank you for your purchase!</p>
              <p>Items can be returned within 7 days with receipt.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 absolute bottom-10">
            <button onClick={printReceipt} className="btn-primary">Print Receipt</button>
            <button onClick={() => { setShowReceipt(false); setLastSale(null); }} className="btn-secondary">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
