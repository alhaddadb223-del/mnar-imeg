
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Settings2, 
  Download, 
  CheckCircle2, 
  Loader2, 
  LayoutDashboard,
  ExternalLink,
  Sparkles,
  Archive,
  AlertCircle,
  X,
  Plus,
  Files,
  Cpu,
  Trash2,
  HardDriveDownload,
  Heart,
  Smartphone
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import JSZip from 'jszip';
import { ProcessedImage, AppState, AppConfig } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    images: [],
    frameFile: null,
    framePreview: null,
    isProcessing: false,
    processingProgress: 0,
    config: {
      prefix: 'المنار_',
      quality: 0.9,
      enableAI: false,
      maxDimension: 2500 
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      state.images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      if (state.framePreview) URL.revokeObjectURL(state.framePreview);
    };
  }, []);

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    const newImages: ProcessedImage[] = imageFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      originalFile: file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));

    setState(prev => ({ 
      ...prev, 
      images: [...prev.images, ...newImages] 
    }));
    
    if (e.target) e.target.value = '';
  };

  const handleFrameSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (state.framePreview) URL.revokeObjectURL(state.framePreview);
      setState(prev => ({
        ...prev,
        frameFile: file,
        framePreview: URL.createObjectURL(file)
      }));
    }
  };

  const processSingleImage = async (
    img: ProcessedImage, 
    frameImg: HTMLImageElement,
    config: AppConfig
  ): Promise<{url: string, blob: Blob}> => {
    return new Promise((resolve, reject) => {
      const originalImg = new Image();
      originalImg.src = img.previewUrl;
      
      originalImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context error');

        let targetWidth = originalImg.width;
        let targetHeight = originalImg.height;

        if (targetWidth > config.maxDimension || targetHeight > config.maxDimension) {
          const ratio = Math.min(config.maxDimension / targetWidth, config.maxDimension / targetHeight);
          targetWidth *= ratio;
          targetHeight *= ratio;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(originalImg, 0, 0, targetWidth, targetHeight);
        
        const slicePercent = 0.20; 
        const frameHeaderHeight = frameImg.height * slicePercent;
        const frameFooterHeight = frameImg.height * slicePercent;
        
        const scale = targetWidth / frameImg.width;
        const targetHeaderHeight = frameHeaderHeight * scale;
        const targetFooterHeight = frameFooterHeight * scale;

        ctx.drawImage(frameImg, 0, 0, frameImg.width, frameHeaderHeight, 0, 0, targetWidth, targetHeaderHeight);
        ctx.drawImage(frameImg, 0, frameImg.height - frameFooterHeight, frameImg.width, frameFooterHeight, 0, targetHeight - targetFooterHeight, targetWidth, targetFooterHeight);

        const frameMiddleHeight = frameImg.height - (frameHeaderHeight + frameFooterHeight);
        const targetMiddleHeight = targetHeight - (targetHeaderHeight + targetFooterHeight);
        
        if (targetMiddleHeight > 0) {
            ctx.drawImage(frameImg, 0, frameHeaderHeight, frameImg.width, frameMiddleHeight, 0, targetHeaderHeight, targetWidth, targetMiddleHeight);
        }

        canvas.toBlob((blob) => {
          if (!blob) return reject('Blob creation failed');
          resolve({ url: URL.createObjectURL(blob), blob: blob });
        }, 'image/jpeg', config.quality);
      };
      originalImg.onerror = () => reject('Load error');
    });
  };

  const startBatchProcess = async () => {
    if (!state.frameFile || state.images.length === 0) return;
    setState(prev => ({ ...prev, isProcessing: true, processingProgress: 0 }));
    const frameImg = new Image();
    frameImg.src = state.framePreview!;
    await new Promise(res => frameImg.onload = res);
    const updatedImages = [...state.images];
    for (let i = 0; i < updatedImages.length; i++) {
      if (updatedImages[i].status === 'completed') continue;
      try {
        updatedImages[i] = { ...updatedImages[i], status: 'processing' };
        setState(prev => ({ ...prev, images: [...updatedImages] }));
        const { url, blob } = await processSingleImage(updatedImages[i], frameImg, state.config);
        updatedImages[i] = { ...updatedImages[i], status: 'completed', processedUrl: url, processedBlob: blob };
      } catch (err) {
        updatedImages[i] = { ...updatedImages[i], status: 'error' };
      }
      const progress = Math.round(((i + 1) / updatedImages.length) * 100);
      setState(prev => ({ ...prev, images: [...updatedImages], processingProgress: progress }));
    }
    setState(prev => ({ ...prev, isProcessing: false }));
  };

  const downloadZip = async () => {
    setIsSaving(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${state.config.prefix}صور_المنار`);
      state.images.filter(img => img.status === 'completed' && img.processedBlob).forEach(img => {
        folder?.file(`${state.config.prefix}${img.name.split('.')[0]}.jpg`, img.processedBlob!);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${state.config.prefix}الكلية_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      alert('فشل إنشاء ملف ZIP.');
    } finally {
      setIsSaving(false);
    }
  };

  const stats = {
    total: state.images.length,
    completed: state.images.filter(i => i.status === 'completed').length,
    processing: state.images.filter(i => i.status === 'processing').length,
    pending: state.images.filter(i => i.status === 'pending').length,
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col text-slate-900 overflow-x-hidden pb-10">
      {/* Header Bar */}
      <header className="bg-indigo-950 text-white shadow-xl z-30 sticky top-0 px-4 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-400 rounded-lg rotate-3 hidden sm:block">
              <Cpu className="text-indigo-950 h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Al-Manar Pro-Frame</h1>
              <p className="text-indigo-300 text-[10px] font-medium hidden sm:block">نظام الأتمتة الإعلامي - كلية المنار الجامعية</p>
            </div>
          </div>
          <button onClick={() => setState(prev => ({...prev, images: []}))} className="px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:text-white flex items-center gap-1">
            <Trash2 size={14} /> <span className="hidden sm:inline">مسح الكل</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-900 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h2 className="font-bold text-slate-700">إطار الكلية الرسمي</h2>
            </div>
            <div onClick={() => frameInputRef.current?.click()} className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${state.framePreview ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'}`}>
              {state.framePreview ? (
                <img src={state.framePreview} alt="Frame" className="max-h-24 mx-auto rounded shadow-sm" />
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="text-[11px] text-slate-500">ارفع إطار (PNG)</p>
                </div>
              )}
              <input type="file" ref={frameInputRef} onChange={handleFrameSelect} accept="image/png" className="hidden" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-900 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h2 className="font-bold text-slate-700">صور الفعالية</h2>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-50 border border-slate-200 py-6 rounded-xl flex flex-col items-center gap-2 hover:bg-indigo-50 transition-all group">
              <Files className="h-6 w-6 text-indigo-600" />
              <span className="text-slate-800 font-bold text-sm">استيراد الصور</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImagesSelect} multiple accept="image/*" className="hidden" />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-indigo-600" />
              <h2 className="font-bold text-slate-700 text-sm">الإعدادات</h2>
            </div>
            <input type="text" value={state.config.prefix} onChange={(e) => setState(prev => ({...prev, config: {...prev.config, prefix: e.target.value}}))} className="w-full px-3 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" placeholder="بادئة الملفات..." />
            <button disabled={state.images.length === 0 || !state.frameFile || state.isProcessing} onClick={startBatchProcess} className="w-full bg-indigo-950 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-900 disabled:bg-slate-300 transition-all shadow-lg active:scale-95">
              {state.isProcessing ? (
                <><Loader2 className="animate-spin h-5 w-5" /><span>جاري العمل {state.processingProgress}%</span></>
              ) : (
                <><LayoutDashboard className="h-5 w-5 text-amber-400" /><span>بدء المعالجة الجماعية</span></>
              )}
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">المجموع</span><span className="text-xl font-black text-indigo-950">{stats.total}</span></div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">تم</span><span className="text-xl font-black text-emerald-600">{stats.completed}</span></div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">جارٍ</span><span className="text-xl font-black text-amber-500">{stats.processing}</span></div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">بانتظارنا</span><span className="text-xl font-black text-slate-400">{stats.pending}</span></div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[500px] sm:h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><ImageIcon size={16} className="text-indigo-600" />المعرض</h3>
              {stats.completed > 0 && (
                <button onClick={downloadZip} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-50">
                  {isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <HardDriveDownload size={14} />}تحميل الكل (ZIP)
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 scrollbar-hide">
              {state.images.length === 0 ? (
                <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                   <Smartphone size={64} strokeWidth={1} />
                   <p className="text-xs font-bold mt-4">جاهز للعمل على هاتفك</p>
                </div>
              ) : (
                state.images.map(img => (
                  <div key={img.id} className="group relative bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                    <div className="aspect-square w-full relative">
                      <img src={img.processedUrl || img.previewUrl} alt={img.name} className={`w-full h-full object-cover ${img.status === 'processing' ? 'opacity-30' : 'opacity-100'}`} />
                      {img.status === 'completed' && <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg"><CheckCircle2 size={12} /></div>}
                      {img.status === 'processing' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Custom Credits */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 text-center mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Al-Manar Pro-Frame &copy; {new Date().getFullYear()}</p>
             <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-bold">تم التصميم والتطوير بواسطة عبدالملك الحداد-771991074</span>
             </div>
          </div>
          
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 w-full max-w-sm">
             <div className="flex items-center justify-center gap-2 mb-2">
                <Heart size={14} className="text-rose-500 fill-rose-500 animate-pulse" />
                <span className="text-xs font-bold text-indigo-900">المطور: عبدالملك الحداد</span>
             </div>
             <a href="tel:771991074" className="text-lg font-black text-indigo-950 block hover:text-indigo-600 transition">771991074</a>
             <p className="text-[9px] text-indigo-400 mt-1 uppercase font-bold tracking-tighter">جاهز للتحويل إلى APK عبر PWABuilder</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
