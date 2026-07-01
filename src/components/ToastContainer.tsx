/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, CheckCircle, RefreshCw, Trash2, PlusCircle, 
  AlertCircle, ShieldAlert, Info, User
} from 'lucide-react';
import { AppToast } from '../types';

interface ToastContainerProps {
  toasts: AppToast[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div id="toast-notification-wrapper" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none md:max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: AppToast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 7000); // auto close after 7s
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  // Determine styles and icons based on activity / type
  let icon = <Info className="h-5 w-5 text-blue-600" />;
  let borderLeftColor = 'border-l-blue-500';
  let badgeClass = 'bg-blue-50 text-blue-700 border-blue-100';

  if (toast.aktivitas === 'Tambah Data') {
    icon = <PlusCircle className="h-5 w-5 text-emerald-600" />;
    borderLeftColor = 'border-l-emerald-500';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (toast.aktivitas === 'Hapus Data') {
    icon = <Trash2 className="h-5 w-5 text-rose-600" />;
    borderLeftColor = 'border-l-rose-500';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-100';
  } else if (toast.aktivitas === 'Update Progress') {
    icon = <RefreshCw className="h-5 w-5 text-amber-500" />;
    borderLeftColor = 'border-l-amber-500';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (toast.type === 'error') {
    icon = <ShieldAlert className="h-5 w-5 text-red-600" />;
    borderLeftColor = 'border-l-red-500';
    badgeClass = 'bg-red-50 text-red-700 border-red-100';
  } else if (toast.type === 'success') {
    icon = <CheckCircle className="h-5 w-5 text-emerald-600" />;
    borderLeftColor = 'border-l-emerald-500';
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  return (
    <motion.div
      id={`toast-item-${toast.id}`}
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-start gap-3 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 border-l-4 ${borderLeftColor} overflow-hidden w-full`}
    >
      <div className="mt-0.5 shrink-0">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider block shrink-0 max-w-max leading-none ${badgeClass}`}>
            {toast.aktivitas || 'Sistem'}
          </span>
          <span className="text-[9px] text-slate-400 font-bold block shrink-0">
            Real-Time Update
          </span>
        </div>

        <p className="text-slate-700 text-xs font-semibold leading-relaxed break-words">
          {toast.message}
        </p>

        {toast.user && (
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-slate-500 bg-slate-50 py-0.5 px-2 rounded-lg border border-slate-100 max-w-max">
            <User className="h-2.5 w-2.5 text-slate-400" />
            <span className="font-bold">Oleh:</span>
            <span className="font-medium truncate max-w-[150px]">{toast.user}</span>
          </div>
        )}
      </div>

      <button
        id={`toast-close-${toast.id}`}
        onClick={() => onClose(toast.id)}
        className="shrink-0 p-1 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
