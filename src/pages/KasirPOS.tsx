import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { tenantFrom, formatCurrency, generateInvoiceNumber } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Medicine, Patient, Doctor, MedicineBatch, MedicineUnit } from '@/lib/supabase';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Search, Plus, Minus, Trash2, ChevronDown, Printer, CheckCircle, ScanLine, Pause, Play, Tag, X, UserPlus, CreditCard } from 'lucide-react';

const CATEGORIES = ['Obat Bebas', 'Obat Bebas Terbatas', 'Obat Keras', 'Obat Narkotika', 'Obat Herbal', 'Suplemen', 'Minuman', 'Alat Kesehatan', 'Lainnya'];

type CartItem = {
  medicine: Medicine;
  quantity: number;
  discount: number;
  usage: string;
  maxQuantity: number | null;
  unit: MedicineUnit | null;
};

type ParkedSale = {
  id: string;
  label: string;
  createdAt: string;
  cart: CartItem[];
  saleType: 'regular' | 'prescription' | 'doctor';
  patient: Patient | null;
  patientName: string;
  doctor: Doctor | null;
  doctorName: string;
  doctorSip: string;
  discount: number;
};

type PaymentPart = { method: 'cash' | 'qris' | 'transfer' | 'card'; amount: string; bank: string };

type ReceiptData = {
  invoiceNumber: string;
  patientName: string;
  doctorName: string;
  cashierName: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  items: { name: string; qty: number; price: number; total: number; usage: string }[];
  doctorSip: string;
  pharmacy: {
    name: string;
    address: string;
    phone: string;
    email: string;
    pharmacistName: string;
    sipaNumber: string;
    siaNumber: string;
  };
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer Bank', card: 'Kartu Debit/Kredit',
};

const BANKS = ['BCA', 'BNI', 'BRI', 'Mandiri', 'BSI', 'CIMB Niaga', 'Lainnya'];

function printLabel(data: { pharmacyName: string; date: string; patientName: string; medicineName: string; quantity: number; usage: string }) {
  const html = `<!doctype html><html><head><title>Etiket</title><style>@page{size:70mm 35mm;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;width:70mm;height:35mm;margin:0;padding:4mm;color:#111}.brand{font-size:12px;font-weight:700}.date{font-size:9px;color:#555}.patient{font-size:11px;margin:2mm 0;border-bottom:1px solid #222;padding-bottom:1mm}.medicine{font-size:12px;font-weight:700}.qty{font-size:10px;margin-top:1mm}.usage{font-size:10px;margin-top:2mm;font-weight:600}</style></head><body><div class="brand">${escapeHtml(data.pharmacyName)}</div><div class="date">${escapeHtml(data.date)}</div><div class="patient">Pasien: ${escapeHtml(data.patientName)}</div><div class="medicine">${escapeHtml(data.medicineName)}</div><div class="qty">Jumlah: ${data.quantity}</div><div class="usage">Aturan pakai: ${escapeHtml(data.usage || '-')}</div></body></html>`;
  const win = window.open('', '_blank', 'width=420,height=260');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

const RECEIPT_WIDTH = 58; // mm — change to 80 for wider paper
const SEP = '-'.repeat(32);

function printReceipt(data: ReceiptData) {
  const now = new Date();
  const dateStr = now.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const p = data.pharmacy;
  const cashier = data.cashierName || 'Kasir';

  const rows: string[] = [];

  // Header — pharmacy info
  rows.push(`<div class="center bold lg">${escapeHtml(p.name)}</div>`);
  if (p.address) rows.push(`<div class="center sm">${escapeHtml(p.address)}</div>`);
  if (p.phone) rows.push(`<div class="center sm">Telp: ${escapeHtml(p.phone)}</div>`);
  if (p.email) rows.push(`<div class="center sm">${escapeHtml(p.email)}</div>`);
  if (p.pharmacistName) rows.push(`<div class="center sm">Apoteker: ${escapeHtml(p.pharmacistName)}</div>`);
  if (p.sipaNumber || p.siaNumber) {
    const lic = [p.sipaNumber && `SIPA: ${p.sipaNumber}`, p.siaNumber && `SIA: ${p.siaNumber}`].filter(Boolean).join('  ');
    rows.push(`<div class="center xs">${escapeHtml(lic)}</div>`);
  }
  rows.push(`<div class="sep">${SEP}</div>`);

  // Transaction info
  rows.push(`<div class="row"><span>No</span><span>${escapeHtml(data.invoiceNumber)}</span></div>`);
  rows.push(`<div class="row"><span>Tgl</span><span>${dateStr}</span></div>`);
  rows.push(`<div class="row"><span>Kasir</span><span>${escapeHtml(cashier)}</span></div>`);
  rows.push(`<div class="row"><span>Pasien</span><span>${escapeHtml(data.patientName)}</span></div>`);
  if (data.doctorName) rows.push(`<div class="row"><span>Dokter</span><span>${escapeHtml(data.doctorName)}</span></div>`);
  if (data.doctorSip) rows.push(`<div class="row"><span>SIP</span><span>${escapeHtml(data.doctorSip)}</span></div>`);
  rows.push(`<div class="sep">${SEP}</div>`);

  // Items
  for (const item of data.items) {
    rows.push(`<div class="item-name">${escapeHtml(item.name)}</div>`);
    rows.push(`<div class="row sm"><span>${item.qty} x ${formatCurrency(item.price)}</span><span>${formatCurrency(item.total)}</span></div>`);
    if (item.usage) rows.push(`<div class="sm">Aturan: ${escapeHtml(item.usage)}</div>`);
  }

  // Totals
  rows.push(`<div class="sep">${SEP}</div>`);
  rows.push(`<div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>`);
  if (data.discount > 0) rows.push(`<div class="row"><span>Diskon</span><span>-${formatCurrency(data.discount)}</span></div>`);
  if (data.taxAmount > 0) rows.push(`<div class="row"><span>PPN (${data.taxPercent}%)</span><span>${formatCurrency(data.taxAmount)}</span></div>`);
  rows.push(`<div class="row bold total"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>`);
  rows.push(`<div class="row"><span>Bayar (${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod})</span><span>${formatCurrency(data.paidAmount)}</span></div>`);
  if (data.changeAmount > 0) rows.push(`<div class="row"><span>Kembali</span><span>${formatCurrency(data.changeAmount)}</span></div>`);

  // Footer
  rows.push(`<div class="sep">${SEP}</div>`);
  rows.push(`<div class="center">Terima kasih</div>`);
  rows.push(`<div class="center sm">Semoga lekas sembuh</div>`);
  if (p.pharmacistName) {
    rows.push(`<div class="sep">${SEP}</div>`);
    rows.push(`<div class="center xs">Diserahkan oleh:</div>`);
    rows.push(`<div class="center bold">${escapeHtml(p.pharmacistName)}</div>`);
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    @page { size: ${RECEIPT_WIDTH}mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${RECEIPT_WIDTH}mm;
      margin: 0;
      padding: 0;
      height: auto !important;
      min-height: 0 !important;
      max-height: max-content;
      overflow: visible;
      font-family: 'Courier New', 'Consolas', monospace;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
    }
    .receipt {
      width: 100%;
      max-width: ${RECEIPT_WIDTH}mm;
      padding: 5mm;
      margin: 0;
      height: auto !important;
      max-height: max-content;
      page-break-after: avoid;
      break-after: avoid;
      font-size: 11px;
      line-height: 1.35;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .lg { font-size: 13px; }
    .sm { font-size: 10px; }
    .xs { font-size: 9px; }
    .row { display: flex; justify-content: space-between; align-items: baseline; }
    .row span:first-child { padding-right: 4px; }
    .row span:last-child { text-align: right; white-space: nowrap; }
    .item-name { font-size: 10px; margin-top: 1px; word-break: break-word; }
    .sep { font-size: 10px; margin: 2px 0; letter-spacing: 1px; overflow: hidden; white-space: nowrap; }
    .total { font-size: 13px; margin-top: 2px; }
  </style></head><body><div class="receipt">${rows.join('')}</div></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try { document.body.removeChild(iframe); } catch { /* already removed */ }
  };

  let hasPrinted = false;
  const printOnce = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    const w = iframe.contentWindow;
    if (!w) { cleanup(); return; }
    w.focus();
    w.print();
    setTimeout(cleanup, 500);
  };

  iframe.onload = printOnce;

  // Fallback in case onload doesn't fire on some browsers
  setTimeout(() => {
    const w = iframe.contentWindow;
    if (!w) { cleanup(); return; }
    try { printOnce(); } catch { /* ignore */ }
  }, 400);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDatabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const databaseError = error as { message?: string; details?: string; hint?: string; code?: string };
    return [databaseError.message, databaseError.details, databaseError.hint, databaseError.code ? `Kode ${databaseError.code}` : '']
      .filter(Boolean)
      .join(' | ') || JSON.stringify(error);
  }
  return String(error);
}

function isMissingStockQuantityColumn(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const databaseError = error as { code?: string; message?: string };
  return databaseError.code === '42703' ||
    databaseError.code === 'PGRST204' ||
    Boolean(databaseError.message?.toLowerCase().includes('stock_quantity'));
}

function isMissingSaleItemColumn(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'PGRST204';
}

export default function KasirPOS() {
  const { profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineUnits, setMedicineUnits] = useState<MedicineUnit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(() => {
    try { return JSON.parse(localStorage.getItem('apotek-parked-sales') || '[]') as ParkedSale[]; } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saleType, setSaleType] = useState<'regular' | 'prescription' | 'doctor'>('regular');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorSip, setDoctorSip] = useState('');
  const [paymentParts, setPaymentParts] = useState<PaymentPart[]>([{ method: 'cash', amount: '', bank: '' }]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState('');
  const [quickPatientPhone, setQuickPatientPhone] = useState('');
  const [quickPatientGender, setQuickPatientGender] = useState<'L' | 'P'>('L');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountMode, setDiscountMode] = useState<'nominal' | 'percent'>('nominal');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState(11);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [prescriptionError, setPrescriptionError] = useState('');
  const [pharmacy, setPharmacy] = useState<ReceiptData['pharmacy']>({
    name: 'Apotek', address: '', phone: '', email: '', pharmacistName: '', sipaNumber: '', siaNumber: '',
  });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    loadPharmacy();
    searchRef.current?.focus();
  }, []);

  async function loadPharmacy() {
    const { data } = await tenantFrom('settings').select('key, value');
    if (!data) return;
    const map: Record<string, string> = {};
    for (const row of data) map[row.key] = row.value;
    setPharmacy({
      name: map.pharmacy_name || 'Apotek',
      address: map.pharmacy_address || '',
      phone: map.pharmacy_phone || '',
      email: map.pharmacy_email || '',
      pharmacistName: map.pharmacist_name || '',
      sipaNumber: map.sipa_number || '',
      siaNumber: map.sia_number || '',
    });
  }

  async function loadData() {
    const [medsRes, patientsRes, doctorsRes, unitsRes] = await Promise.all([
      tenantFrom('medicines').select('*').eq('is_active', true).order('name'),
      tenantFrom('patients').select('*').order('name'),
      tenantFrom('doctors').select('*').eq('is_active', true).order('name'),
      tenantFrom('medicine_units').select('*').order('unit_name'),
    ]);
    setMedicines(medsRes.data ?? []);
    setPatients(patientsRes.data ?? []);
    setDoctors(doctorsRes.data ?? []);
    setMedicineUnits((unitsRes.data ?? []) as MedicineUnit[]);
  }

  const filteredMeds = useMemo(() => medicines.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.generic_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.barcode ?? '').includes(search);
    const matchCat = categoryFilter === 'all' || m.category === categoryFilter;
    return matchSearch && matchCat;
  }), [medicines, search, categoryFilter]);

  function getPrice(med: Medicine): number {
    const doctorPricingActive = saleType === 'doctor' || selectedDoctor !== null;
    if (doctorPricingActive) {
      const p = med.price_doctor || med.price_regular || med.sell_price;
      return p > 0 ? p : med.sell_price;
    }
    if (saleType === 'prescription') {
      const p = med.price_prescription || med.sell_price;
      return p > 0 ? p : med.sell_price;
    }
    const p = med.price_regular || med.sell_price;
    return p > 0 ? p : med.sell_price;
  }

  function addToCart(med: Medicine) {
    if (med.stock <= 0) return;
    setCart(prev => {
      const exists = prev.find(i => i.medicine.id === med.id);
      if (exists) {
        return prev.map(i => i.medicine.id === med.id && i.quantity < i.medicine.stock
          ? { ...i, quantity: i.quantity + 1 }
          : i
        );
      }
      return [...prev, { medicine: med, quantity: 1, discount: 0, usage: '', maxQuantity: null, unit: null }];
    });
  }

  const handleBarcodeScan = useCallback((code: string) => {
    const found = medicines.find(m => m.barcode === code && m.is_active);
    if (found) {
      setShowScanner(false);
      addToCart(found);
    } else {
      alert(`Barcode "${code}" tidak ditemukan.`);
    }
  }, [medicines]);

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.medicine.id !== id) return i;
      const newQty = i.quantity + delta;
      if (newQty < 1) return i;
      if (newQty > i.medicine.stock || (i.maxQuantity !== null && newQty > i.maxQuantity)) return i;
      return { ...i, quantity: newQty };
    }));
  }

  function setQty(id: string, qty: number) {
    setCart(prev => prev.map(i => {
      if (i.medicine.id !== id) return i;
      if (isNaN(qty) || qty < 1) return { ...i, quantity: 1 };
      if (qty > i.medicine.stock || (i.maxQuantity !== null && qty > i.maxQuantity)) return { ...i, quantity: Math.min(i.medicine.stock, i.maxQuantity ?? i.medicine.stock) };
      return { ...i, quantity: qty };
    }));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.medicine.id !== id));
  }

  function updateItemDetail(id: string, field: 'usage' | 'maxQuantity', value: string) {
    setCart(prev => prev.map(item => item.medicine.id === id
      ? { ...item, [field]: field === 'maxQuantity' ? (value ? Math.max(1, Number(value)) : null) : value }
      : item));
  }

  function updateItemUnit(id: string, unitId: string) {
    const unit = medicineUnits.find(item => item.id === unitId) ?? null;
    setCart(prev => prev.map(item => item.medicine.id === id ? { ...item, unit } : item));
  }

  function getUnitOptions(medicineId: string) {
    return medicineUnits.filter(unit => unit.medicine_id === medicineId);
  }

  function getItemPrice(item: CartItem) {
    if (!item.unit) return getPrice(item.medicine);
    if (saleType === 'doctor' || selectedDoctor !== null) {
      const masterDoctorPrice = item.medicine.price_doctor || item.medicine.price_regular || item.medicine.sell_price;
      return item.unit.price_doctor > 0 ? item.unit.price_doctor : masterDoctorPrice * item.unit.conversion_factor;
    }
    if (saleType === 'prescription') return item.unit.price_prescription;
    return item.unit.price_regular;
  }

  function getBaseQuantity(item: CartItem) {
    return item.quantity * (item.unit?.conversion_factor ?? 1);
  }

  const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity - i.discount, 0);
  const effectiveDiscount = discountMode === 'percent'
    ? Math.round(subtotal * (discountPercent / 100))
    : globalDiscount;
  const total = Math.max(0, subtotal - effectiveDiscount);
  const taxBase = Math.max(0, subtotal - effectiveDiscount);
  const taxAmount = taxEnabled ? Math.round(taxBase * taxPercent / 100) : 0;
  const grandTotal = total + taxAmount;
  const paidAmount = paymentParts.reduce((sum, part) => sum + (Number(part.amount) || 0), 0);
  const cashPaid = paymentParts.filter(part => part.method === 'cash').reduce((sum, part) => sum + (Number(part.amount) || 0), 0);
  const change = Math.max(0, cashPaid - grandTotal);
  const paymentMethod = paymentParts[0]?.method || 'cash';
  const databasePaymentMethod = paymentMethod === 'qris' ? 'transfer' : paymentMethod === 'card' ? 'debit' : paymentMethod;

  function updatePayment(index: number, changes: Partial<PaymentPart>) {
    setPaymentParts(prev => prev.map((part, partIndex) => partIndex === index ? { ...part, ...changes } : part));
  }

  function addPaymentPart() {
    setPaymentParts(prev => [...prev, { method: 'qris', amount: '', bank: '' }]);
  }

  function removePaymentPart(index: number) {
    setPaymentParts(prev => prev.length === 1 ? prev : prev.filter((_, partIndex) => partIndex !== index));
  }

  function parkSale() {
    if (cart.length === 0) return;
    const id = `P-${Date.now()}`;
    const parked: ParkedSale = {
      id, label: `${id} · ${patientName || selectedPatient?.name || 'Umum'}`, createdAt: new Date().toISOString(),
      cart, saleType, patient: selectedPatient, patientName, doctor: selectedDoctor, doctorName, doctorSip,
      discount: globalDiscount,
    };
    const next = [...parkedSales, parked];
    setParkedSales(next);
    localStorage.setItem('apotek-parked-sales', JSON.stringify(next));
    resetCart();
  }

  function resumeSale(id: string) {
    const parked = parkedSales.find(item => item.id === id);
    if (!parked) return;
    setCart(parked.cart);
    setSaleType(parked.saleType);
    setSelectedPatient(parked.patient);
    setPatientName(parked.patientName);
    setPatientSearch(parked.patient ? '' : parked.patientName);
    setSelectedDoctor(parked.doctor);
    setDoctorName(parked.doctorName);
    setDoctorSip(parked.doctorSip);
    setGlobalDiscount(parked.discount);
    const next = parkedSales.filter(item => item.id !== id);
    setParkedSales(next);
    localStorage.setItem('apotek-parked-sales', JSON.stringify(next));
  }

  async function quickAddPatient() {
    if (!quickPatientName.trim()) return;
    const { data, error } = await tenantFrom('patients').insert({ name: quickPatientName.trim(), phone: quickPatientPhone || null, gender: quickPatientGender }).select().single();
    if (error || !data) { alert('Pasien baru gagal disimpan.'); return; }
    const patient = data as Patient;
    setPatients(prev => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedPatient(patient);
    setPatientName(patient.name);
    setPatientSearch('');
    setShowQuickPatient(false);
    setQuickPatientName('');
    setQuickPatientPhone('');
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    if (saleType === 'prescription' && (!selectedPatient && !patientName.trim() || !doctorName.trim() || !doctorSip.trim())) {
      setPrescriptionError('Penjualan resep wajib mengisi Nama Dokter, Nama Pasien, dan No. SIP Dokter.');
      return;
    }
    if (saleType === 'doctor' && (!doctorName.trim() || !doctorSip.trim())) {
      setPrescriptionError('Penjualan dokter wajib mengisi Nama Dokter dan No. SIP Dokter.');
      return;
    }
    if (paidAmount < grandTotal || (paymentParts.some(part => part.method === 'cash') && cashPaid < grandTotal && paymentParts.length === 1)) {
      alert('Uang yang dibayar kurang!');
      return;
    }
    setLoading(true);
    let createdSaleId: string | null = null;
    const allocations: { item: CartItem; batchId: string | null; quantity: number; buyPrice: number }[] = [];
    const updatedAllocations: typeof allocations = [];
    const updatedMedicines: CartItem[] = [];
    try {
      for (const item of cart) {
        let remaining = getBaseQuantity(item);
        let batchRows: unknown[] | null = null;
        let usesStockQuantity = true;
        const batchQuery = await tenantFrom('medicine_batches')
          .select('id, quantity, stock_quantity, buy_price, expiry_date')
          .eq('medicine_id', item.medicine.id)
          .order('expiry_date', { ascending: true });
        if (batchQuery.error && isMissingStockQuantityColumn(batchQuery.error)) {
          usesStockQuantity = false;
          const legacyQuery = await tenantFrom('medicine_batches')
            .select('id, quantity, buy_price, expiry_date')
            .eq('medicine_id', item.medicine.id)
            .order('expiry_date', { ascending: true });
          if (legacyQuery.error) throw new Error(`Gagal membaca batch ${item.medicine.name}: ${getDatabaseErrorMessage(legacyQuery.error)}`);
          batchRows = legacyQuery.data ?? [];
        } else {
          if (batchQuery.error) throw new Error(`Gagal membaca batch ${item.medicine.name}: ${getDatabaseErrorMessage(batchQuery.error)}`);
          batchRows = batchQuery.data ?? [];
        }
        for (const batch of (batchRows ?? []) as Pick<MedicineBatch, 'id' | 'quantity' | 'stock_quantity' | 'buy_price'>[]) {
          if (remaining <= 0) break;
          const available = usesStockQuantity && batch.stock_quantity > 0 ? batch.stock_quantity : batch.quantity;
          if (available <= 0) continue;
          const allocated = Math.min(remaining, available);
          allocations.push({ item, batchId: batch.id, quantity: allocated, buyPrice: batch.buy_price ?? item.medicine.buy_price ?? 0 });
          remaining -= allocated;
        }
        // Legacy medicines may have aggregate stock but no initialized batches.
        if (remaining > 0 && item.medicine.stock >= remaining) {
          allocations.push({ item, batchId: null, quantity: remaining, buyPrice: item.medicine.buy_price ?? 0 });
          remaining = 0;
        }
        if (remaining > 0) throw new Error(`Stok batch ${item.medicine.name} tidak mencukupi.`);
      }
      const invoiceNumber = generateInvoiceNumber();
      const { data: sale, error: saleError } = await tenantFrom('sales').insert({
        invoice_number: invoiceNumber,
        patient_id: selectedPatient?.id ?? null,
        doctor_id: selectedDoctor?.id ?? null,
        patient_name: selectedPatient?.name ?? (patientName || 'Umum'),
        payment_method: databasePaymentMethod,
        sale_type: saleType,
        subtotal,
        discount: effectiveDiscount,
        total: grandTotal,
        tax_percent: taxEnabled ? taxPercent : 0,
        tax_amount: taxAmount,
        paid_amount: paidAmount,
        change_amount: change,
        cashier_name: profile?.full_name ?? 'Kasir',
      }).select().single();

      if (saleError) throw new Error(`Gagal membuat invoice: ${getDatabaseErrorMessage(saleError)}`);
      createdSaleId = sale.id;

      const saleItems = allocations.map(allocation => ({
        sale_id: sale.id,
        medicine_id: allocation.item.medicine.id,
        medicine_name: allocation.item.medicine.name,
        quantity: allocation.quantity,
        unit_price: getItemPrice(allocation.item) / (allocation.item.unit?.conversion_factor ?? 1),
        cost_price: allocation.buyPrice,
        discount: allocation.item.discount,
        total_price: (getItemPrice(allocation.item) / (allocation.item.unit?.conversion_factor ?? 1)) * allocation.quantity,
        batch_id: allocation.batchId,
        unit_id: allocation.item.unit?.id ?? null,
        unit_name: allocation.item.unit?.unit_name ?? allocation.item.medicine.unit,
        conversion_factor: allocation.item.unit?.conversion_factor ?? 1,
      }));
      const itemsInsert = await tenantFrom('sale_items').insert(saleItems);
      if (itemsInsert.error && isMissingSaleItemColumn(itemsInsert.error)) {
        const legacySaleItems = saleItems.map(({ batch_id: _batchId, unit_id: _unitId, unit_name: _unitName, conversion_factor: _conversionFactor, ...item }) => item);
        const legacyInsert = await tenantFrom('sale_items').insert(legacySaleItems);
        if (legacyInsert.error) throw new Error(`Gagal menyimpan item transaksi: ${getDatabaseErrorMessage(legacyInsert.error)}`);
      } else if (itemsInsert.error) {
        throw new Error(`Gagal menyimpan item transaksi: ${getDatabaseErrorMessage(itemsInsert.error)}`);
      }

      for (const item of cart) {
        const baseQuantity = getBaseQuantity(item);
        const batchStockQuery = await tenantFrom('medicine_batches').select('id, quantity, stock_quantity').eq('medicine_id', item.medicine.id);
        const currentBatches = batchStockQuery.error && isMissingStockQuantityColumn(batchStockQuery.error)
          ? (await tenantFrom('medicine_batches').select('id, quantity').eq('medicine_id', item.medicine.id)).data
          : batchStockQuery.data;
        const currentBatchesError = batchStockQuery.error && !isMissingStockQuantityColumn(batchStockQuery.error) ? batchStockQuery.error : null;
        if (currentBatchesError) throw new Error(`Gagal membaca stok batch: ${getDatabaseErrorMessage(currentBatchesError)}`);
        let remaining = baseQuantity;
        for (const batch of (currentBatches ?? []) as Pick<MedicineBatch, 'id' | 'quantity' | 'stock_quantity'>[]) {
          if (remaining <= 0) break;
          const available = batch.stock_quantity ?? batch.quantity;
          const used = allocations.filter(a => a.item.medicine.id === item.medicine.id && a.batchId === batch.id).reduce((sum, a) => sum + a.quantity, 0);
          if (used <= 0) continue;
          const nextStock = Math.max(0, available - used);
          const batchUpdate = await tenantFrom('medicine_batches').update({ stock_quantity: nextStock, quantity: nextStock, updated_at: new Date().toISOString() }).eq('id', batch.id);
          const batchUpdateError = isMissingStockQuantityColumn(batchUpdate.error)
            ? (await tenantFrom('medicine_batches').update({ quantity: nextStock, updated_at: new Date().toISOString() }).eq('id', batch.id)).error
            : batchUpdate.error;
          if (batchUpdateError) throw new Error(`Gagal mengurangi batch ${batch.id}: ${getDatabaseErrorMessage(batchUpdateError)}`);
          updatedAllocations.push(...allocations.filter(allocation => allocation.item.medicine.id === item.medicine.id && allocation.batchId === batch.id));
          remaining -= used;
        }
        const { error: medicineUpdateError } = await tenantFrom('medicines').update({
          stock: Math.max(0, item.medicine.stock - baseQuantity),
          updated_at: new Date().toISOString(),
        }).eq('id', item.medicine.id);
        if (medicineUpdateError) throw new Error(`Gagal memperbarui stok ${item.medicine.name}: ${getDatabaseErrorMessage(medicineUpdateError)}`);
        updatedMedicines.push(item);
      }

      const receiptData: ReceiptData = {
        invoiceNumber,
        patientName: selectedPatient?.name ?? (patientName || 'Umum'),
        doctorName,
        cashierName: profile?.full_name ?? 'Kasir',
        paymentMethod,
        subtotal,
        discount: effectiveDiscount,
        total: grandTotal,
        taxPercent: taxEnabled ? taxPercent : 0,
        taxAmount,
        paidAmount,
        changeAmount: paymentMethod === 'cash' ? change : 0,
        doctorSip,
        items: cart.map(i => ({ name: i.medicine.name, qty: i.quantity, price: getItemPrice(i), total: getItemPrice(i) * i.quantity - i.discount, usage: i.usage })),
        pharmacy,
      };
      setSuccess(invoiceNumber);
      setCompletedReceipt(receiptData);
      resetCart();
      loadData();
    } catch (err) {
      console.error('Checkout transaction failed', err);
      if (createdSaleId) {
        for (const item of updatedMedicines) {
          await tenantFrom('medicines').update({ stock: item.medicine.stock, updated_at: new Date().toISOString() }).eq('id', item.medicine.id);
        }
        for (const allocation of updatedAllocations) {
          const { data: batch } = await tenantFrom('medicine_batches').select('stock_quantity, quantity').eq('id', allocation.batchId).single();
          if (batch) await tenantFrom('medicine_batches').update({ stock_quantity: (batch.stock_quantity ?? batch.quantity) + allocation.quantity, quantity: (batch.stock_quantity ?? batch.quantity) + allocation.quantity }).eq('id', allocation.batchId);
        }
        await tenantFrom('sale_items').delete().eq('sale_id', createdSaleId);
        await tenantFrom('sales').delete().eq('id', createdSaleId);
      }
      const message = getDatabaseErrorMessage(err);
      alert(`Transaksi gagal: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  function closeCompletedReceipt() {
    setCompletedReceipt(null);
    setSuccess(null);
    setIsPrinting(false);
  }

  function printCompletedReceipt() {
    if (!completedReceipt || isPrinting) return;
    setIsPrinting(true);
    printReceipt(completedReceipt);
  }

  function resetCart() {
    setCart([]);
    setSelectedPatient(null);
    setSelectedDoctor(null);
    setPatientName('');
    setPaymentParts([{ method: 'cash', amount: '', bank: '' }]);
    setGlobalDiscount(0);
    setDiscountPercent(0);
    setDiscountMode('nominal');
    setTaxEnabled(false);
    setTaxPercent(11);
    setPatientSearch('');
    setDoctorSearch('');
    setDoctorName('');
    setDoctorSip('');
    setSearch('');
    setPrescriptionError('');
  }

  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()));
  const filteredDoctors = doctors.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase()));

  return (
    <div className="flex h-full">
      {/* Left: Product Search */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <div className="p-4 bg-white border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg mb-3">Kasir POS</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama obat, generik, atau scan barcode..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
              />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-medium text-gray-700"
              >
                <option value="all">Semua Kategori</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <ScanLine size={16} /> Scan
            </button>
          </div>
          {/* Sale Type Toggle */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500 font-medium">Jenis Penjualan:</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {([['regular', 'Penjualan Umum'], ['prescription', 'Penjualan Resep'], ['doctor', 'Penjualan Dokter']] as const).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => { setSaleType(type); setPrescriptionError(''); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${saleType === type ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start">
          {filteredMeds.map(med => (
            <button
              key={med.id}
              onClick={() => addToCart(med)}
              disabled={med.stock <= 0}
              className={`text-left bg-white border rounded-xl p-3 transition-all hover:shadow-md hover:border-teal-300 active:scale-95 ${
                med.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{med.name}</p>
                {med.requires_prescription && (
                  <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">R/</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">{med.category}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-teal-600">{formatCurrency(getPrice(med))}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  med.stock <= 0 ? 'bg-red-100 text-red-600' :
                  med.stock <= med.min_stock ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                }`}>{med.stock} {med.unit}{med.pieces_per_strip > 1 && med.unit === 'strip' ? ` (${med.pieces_per_strip} pcs)` : ''}</span>
              </div>
            </button>
          ))}
          {filteredMeds.length === 0 && (
            <div className="col-span-3 text-center text-gray-400 py-16">
              <Search size={32} className="mx-auto mb-2 text-gray-300" />
              <p>Obat tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-white border-l border-gray-100 shadow-sm">
        {/* Patient & Doctor */}
        <div className="p-4 border-b border-gray-100 space-y-2">
          <div className="relative">
            <label className="text-xs text-gray-500 font-medium">Pasien</label>
            <input
              value={selectedPatient ? selectedPatient.name : patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setPatientName(e.target.value); setSelectedPatient(null); }}
              placeholder="Cari pasien atau ketik nama..."
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button type="button" onClick={() => setShowQuickPatient(true)} className="absolute right-2 top-6 text-teal-600 hover:text-teal-700" title="Tambah pasien baru">
              <UserPlus size={15} />
            </button>
            {patientSearch && !selectedPatient && filteredPatients.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                {filteredPatients.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientName(p.name); setPatientSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 ml-2">{p.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="text-xs text-gray-500 font-medium">Dokter (Resep)</label>
            <input
              value={selectedDoctor ? selectedDoctor.name : doctorName || doctorSearch}
              onChange={e => { setDoctorSearch(e.target.value); setDoctorName(e.target.value); setSelectedDoctor(null); }}
              placeholder="Cari dokter..."
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {doctorSearch && !selectedDoctor && filteredDoctors.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                {filteredDoctors.slice(0, 5).map(d => (
                  <button key={d.id} onClick={() => { setSelectedDoctor(d); setDoctorName(d.name); setDoctorSip(d.sip_number ?? ''); setDoctorSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium">{d.name}</span>
                    <span className="text-gray-400 ml-2">{d.specialization}</span>
                  </button>
                ))}
              </div>
            )}
            {saleType !== 'regular' && (
              <input
                value={doctorSip}
                onChange={e => setDoctorSip(e.target.value)}
                placeholder="No. SIP Dokter *"
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            )}
          </div>
          {saleType !== 'regular' && prescriptionError && <p className="text-xs text-red-500">{prescriptionError}</p>}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCartEmpty />
              <p className="text-sm">Pilih obat untuk ditambahkan</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cart.map(item => (
                <div key={item.medicine.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.medicine.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(getItemPrice(item))} / {item.unit?.unit_name ?? item.medicine.unit}{item.unit ? ` (${item.unit.conversion_factor} ${item.medicine.unit})` : ''}</p>
                    </div>
                    <button onClick={() => removeItem(item.medicine.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                    {saleType !== 'regular' && <button onClick={() => printLabel({ pharmacyName: pharmacy.name, date: new Date().toLocaleDateString('id-ID'), patientName: (selectedPatient?.name ?? patientName) || 'Umum', medicineName: item.medicine.name, quantity: item.quantity, usage: item.usage })} className="text-teal-500 hover:text-teal-700 flex-shrink-0" title="Cetak etiket"><Tag size={14} /></button>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button onClick={() => updateQty(item.medicine.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-900">
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => setQty(item.medicine.id, parseInt(e.target.value))}
                        className="w-10 text-center text-sm font-semibold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => updateQty(item.medicine.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-900">
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{formatCurrency(getItemPrice(item) * item.quantity)}</span>
                  </div>
                  {getUnitOptions(item.medicine.id).length > 0 && (
                    <select value={item.unit?.id ?? ''} onChange={e => updateItemUnit(item.medicine.id, e.target.value)} className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400">
                      <option value="">Satuan dasar: {item.medicine.unit}</option>
                      {getUnitOptions(item.medicine.id).map(unit => {
                        const doctorUnitPrice = unit.price_doctor > 0 ? unit.price_doctor : (item.medicine.price_doctor || item.medicine.price_regular || item.medicine.sell_price) * unit.conversion_factor;
                        const unitPrice = saleType === 'doctor' || selectedDoctor !== null
                          ? doctorUnitPrice
                          : saleType === 'prescription' ? unit.price_prescription : unit.price_regular;
                        return <option key={unit.id} value={unit.id}>{unit.unit_name} · {formatCurrency(unitPrice)}</option>;
                      })}
                    </select>
                  )}
                  {saleType !== 'regular' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input value={item.usage} onChange={e => updateItemDetail(item.medicine.id, 'usage', e.target.value)} placeholder="Aturan pakai" className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400" />
                      <input type="number" min="1" value={item.maxQuantity ?? ''} onChange={e => updateItemDetail(item.medicine.id, 'maxQuantity', e.target.value)} placeholder="Maks. jumlah" className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Diskon Global</span>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setDiscountMode('nominal'); setDiscountPercent(0); }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${discountMode === 'nominal' ? 'bg-teal-100 text-teal-700' : 'text-gray-400 hover:text-gray-600'}`}
                >Rp</button>
                <button
                  type="button"
                  onClick={() => { setDiscountMode('percent'); setGlobalDiscount(0); }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${discountMode === 'percent' ? 'bg-teal-100 text-teal-700' : 'text-gray-400 hover:text-gray-600'}`}
                >%</button>
              </div>
            </div>
            <input
              type="number"
              value={discountMode === 'percent' ? (discountPercent || '') : (globalDiscount || '')}
              onChange={e => discountMode === 'percent' ? setDiscountPercent(Number(e.target.value)) : setGlobalDiscount(Number(e.target.value))}
              placeholder="0"
              className="w-full text-right px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            {effectiveDiscount > 0 && (
              <p className="text-xs text-gray-400 text-right">
                {discountMode === 'percent' ? `${discountPercent}% = ${formatCurrency(effectiveDiscount)}` : `Diskon ${formatCurrency(effectiveDiscount)}`}
              </p>
            )}
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2">
            <span>TOTAL</span>
            <span className="text-teal-600">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-600"><input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} className="accent-teal-500" /> Aktifkan PPN</label>
            {taxEnabled && <div className="flex items-center gap-1"><input type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(Math.max(0, Number(e.target.value)))} className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-right text-xs" /><span className="text-gray-500">%</span></div>}
          </div>
          {taxEnabled && <div className="flex justify-between text-sm text-gray-500"><span>PPN ({taxPercent}%)</span><span>{formatCurrency(taxAmount)}</span></div>}

          <div className="flex gap-2">
            <button type="button" onClick={parkSale} disabled={cart.length === 0} className="flex-1 border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40 font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"><Pause size={15} /> Parkir</button>
            <button type="button" onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="flex-[2] bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"><CreditCard size={16} /> Pembayaran</button>
          </div>
          <div className="relative">
            <select value="" onChange={e => resumeSale(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Daftar Antrean ({parkedSales.length})</option>
              {parkedSales.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <Play size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

        </div>
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          title="Scan Barcode - Kasir POS"
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-lg font-bold text-gray-900">Pembayaran Multi-Metode</h3><p className="text-sm text-gray-500">Total: {formatCurrency(grandTotal)}</p></div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {paymentParts.map((part, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <select value={part.method} onChange={e => updatePayment(index, { method: e.target.value as PaymentPart['method'] })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer Bank</option><option value="card">Kartu Debit/Kredit</option></select>
                    {paymentParts.length > 1 && <button onClick={() => removePaymentPart(index)} className="text-gray-400 hover:text-red-500"><X size={16} /></button>}
                  </div>
                  <div className="flex gap-2">
                    <input type="number" min="0" value={part.amount} onChange={e => updatePayment(index, { amount: e.target.value })} placeholder="Nominal pembayaran" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    {(part.method === 'transfer' || part.method === 'card') && <select value={part.bank} onChange={e => updatePayment(index, { bank: e.target.value })} className="w-36 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"><option value="">Bank</option>{BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}</select>}
                  </div>
                  {part.method === 'cash' && <div className="flex gap-1.5"><button type="button" onClick={() => updatePayment(index, { amount: String(grandTotal) })} className="px-2 py-1 text-xs border border-teal-200 text-teal-700 rounded-md">Uang pas</button><button type="button" onClick={() => updatePayment(index, { amount: '50000' })} className="px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded-md">Rp50.000</button><button type="button" onClick={() => updatePayment(index, { amount: '100000' })} className="px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded-md">Rp100.000</button></div>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPaymentPart} className="mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700">+ Tambah metode pembayaran</button>
            <div className="mt-4 border-t border-gray-100 pt-3 space-y-1 text-sm"><div className="flex justify-between"><span className="text-gray-500">Terbayar</span><span className="font-semibold">{formatCurrency(paidAmount)}</span></div><div className="flex justify-between"><span className="text-gray-500">Kembalian tunai</span><span className="font-bold text-green-600">{formatCurrency(change)}</span></div>{paidAmount < grandTotal && <p className="text-red-500 text-xs">Sisa pembayaran: {formatCurrency(grandTotal - paidAmount)}</p>}</div>
            <button onClick={() => { setShowPaymentModal(false); handleCheckout(); }} disabled={loading || paidAmount < grandTotal} className="w-full mt-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2">{loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Printer size={16} />} {loading ? 'Memproses...' : 'Selesaikan & Cetak Struk'}</button>
          </div>
        </div>
      )}

      {showQuickPatient && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-gray-900">Tambah Pasien Cepat</h3><button onClick={() => setShowQuickPatient(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button></div>
            <div className="space-y-3"><input value={quickPatientName} onChange={e => setQuickPatientName(e.target.value)} placeholder="Nama pasien *" className="input" /><input value={quickPatientPhone} onChange={e => setQuickPatientPhone(e.target.value)} placeholder="No. telepon" className="input" /><select value={quickPatientGender} onChange={e => setQuickPatientGender(e.target.value as 'L' | 'P')} className="input"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
            <button onClick={quickAddPatient} disabled={!quickPatientName.trim()} className="w-full mt-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl">Simpan Pasien</button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {success && (
        <div className="fixed top-6 right-6 bg-white border border-green-200 rounded-2xl shadow-xl p-4 flex items-center gap-3 z-50 animate-slide-in">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Transaksi Berhasil!</p>
            <p className="text-sm text-gray-500">Invoice: {success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="ml-4 text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
        </div>
      )}

      {completedReceipt && (
        <div className="fixed inset-0 z-[60] bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center"><CheckCircle size={24} className="text-green-600" /></div>
              <div><h3 className="text-lg font-bold text-gray-900">Transaksi berhasil</h3><p className="text-sm text-gray-500">Invoice {completedReceipt.invoiceNumber} telah tersimpan.</p></div>
              </div>
              <button onClick={closeCompletedReceipt} className="text-gray-400 hover:text-gray-700 text-xl" aria-label="Tutup">×</button>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={printCompletedReceipt} disabled={isPrinting} className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"><Printer size={16} /> {isPrinting ? 'Menyiapkan...' : 'Cetak Struk'}</button>
              <button onClick={closeCompletedReceipt} disabled={isPrinting} className="flex-1 border border-gray-200 hover:bg-gray-50 disabled:opacity-60 rounded-xl py-2.5 text-sm font-semibold text-gray-700">Transaksi Baru</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingCartEmpty() {
  return (
    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
      <Printer size={24} className="text-gray-300" />
    </div>
  );
}
