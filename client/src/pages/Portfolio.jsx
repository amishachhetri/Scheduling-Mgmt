import React, { useEffect, useRef, useState } from 'react';
import { Upload, Star, Trash2, Video, Image as ImageIcon, ExternalLink, Check } from 'lucide-react';
import api from '../utils/api.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';

const CATEGORIES = ['Weddings', 'Portraits', 'Milestones'];

export default function Portfolio() {
  const [configured, setConfigured] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const fileInput = useRef(null);

  // Staged uploads awaiting a category choice before they're saved to the portfolio --
  // each file uploads to Cloudinary right away (so its thumbnail is ready to preview), but
  // isn't added to the portfolio (and isn't live on the site) until Save is clicked below.
  const [pending, setPending] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/media').then(r => { setItems(r.data); setLoading(false); }).catch(() => setLoading(false));

  useEffect(() => {
    api.get('/media/config').then(r => setConfigured(r.data.configured)).catch(() => setConfigured(false));
    load();
  }, []);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const batch = Array.from(files).map(file => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      status: 'uploading',
      category: '',
      data: null
    }));
    setPending(p => [...p, ...batch]);
    setReviewOpen(true);

    for (const entry of batch) {
      try {
        const uploaded = await uploadToCloudinary(entry.file);
        setPending(p => p.map(e => e.key === entry.key ? { ...e, status: 'done', data: uploaded } : e));
      } catch (err) {
        setPending(p => p.map(e => e.key === entry.key ? { ...e, status: 'error' } : e));
        toast.error(`Failed to upload ${entry.file.name}`);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const setCategoryFor = (key, category) => {
    setPending(p => p.map(e => e.key === key ? { ...e, category } : e));
  };

  const setAllCategories = (category) => {
    setPending(p => p.map(e => e.status === 'done' ? { ...e, category } : e));
  };

  const removePending = (key) => setPending(p => p.filter(e => e.key !== key));

  const closeReview = () => {
    if (pending.some(e => e.status === 'uploading')) return; // let uploads finish first
    setReviewOpen(false);
    setPending([]);
  };

  const saveAll = async () => {
    const ready = pending.filter(e => e.status === 'done');
    if (ready.some(e => !e.category)) return toast.error('Choose a category for every photo before saving');
    setSaving(true);
    let succeeded = 0;
    for (const entry of ready) {
      try {
        await api.post('/media', { ...entry.data, category: entry.category });
        succeeded++;
      } catch {
        toast.error(`Failed to save ${entry.file.name}`);
      }
    }
    if (succeeded > 0) toast.success(`Added ${succeeded} item${succeeded !== 1 ? 's' : ''} to the portfolio`);
    setSaving(false);
    setReviewOpen(false);
    setPending([]);
    load();
  };

  const toggleFeatured = async (item) => {
    try {
      await api.put(`/media/${item.id}`, { featured: !item.featured });
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  const remove = async (item) => {
    if (!confirm('Delete this item? This also removes it from Cloudinary.')) return;
    try {
      await api.delete(`/media/${item.id}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filtered = items.filter(i =>
    (filterCategory === 'All' || i.category === filterCategory) &&
    (filterType === 'All' || i.type === filterType.toLowerCase().slice(0, -1))
  );

  const doneCount = pending.filter(e => e.status === 'done').length;
  const uploadingCount = pending.filter(e => e.status === 'uploading').length;

  if (configured === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold dark:text-white">Portfolio</h1>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 max-w-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="font-semibold dark:text-white mb-1">Photo/video uploads aren't set up yet</h2>
          <p className="text-sm text-gray-500 mb-3">
            This uses Cloudinary (free tier is plenty) to host your portfolio photos and videos. Create an account at{' '}
            <a href="https://cloudinary.com/console" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
              cloudinary.com/console
            </a>, then add these three values to the server's <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">.env</code> file and restart the server:
          </p>
          <pre className="text-xs bg-gray-50 dark:bg-gray-900 dark:text-gray-300 rounded-lg p-3 overflow-x-auto">
            {'CLOUDINARY_CLOUD_NAME=\nCLOUDINARY_API_KEY=\nCLOUDINARY_API_SECRET='}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold dark:text-white">Portfolio</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInput.current?.click()} disabled={configured === null}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium">
            <Upload className="w-4 h-4" /> Upload
          </button>
          <input ref={fileInput} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterCategory === c ? 'bg-sky-600 border-sky-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {c}
          </button>
        ))}
        <span className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
        {['All', 'Photos', 'Videos'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterType === t ? 'bg-sky-600 border-sky-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-400">{items.length === 0 ? 'No portfolio media yet — upload your first photo or video' : 'Nothing matches these filters'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 group relative">
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
                <img src={item.thumbnail_url || item.url} alt={item.title || ''} className="w-full h-full object-cover" />
                {item.type === 'video' && (
                  <span className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1">
                    <Video className="w-3 h-3" />
                  </span>
                )}
                <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open original in a new tab"
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-70 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-medium truncate dark:text-white">{item.title || 'Untitled'}</p>
                <p className="text-[11px] text-gray-400">{item.category}</p>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => toggleFeatured(item)} title={item.featured ? 'Featured on Home' : 'Feature on Home'}
                    className={`p-1 rounded ${item.featured ? 'text-amber-500' : 'text-gray-300 hover:text-gray-400'}`}>
                    <Star className="w-3.5 h-3.5" fill={item.featured ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => remove(item)} className="p-1 rounded text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={reviewOpen} onClose={closeReview} title="Choose a category for each upload" size="lg">
        <div className="space-y-4">
          {uploadingCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Uploading {uploadingCount} item{uploadingCount !== 1 ? 's' : ''}…</p>
          )}

          {doneCount > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Set all to:</span>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setAllCategories(c)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto space-y-2 -mx-1 px-1">
            {pending.map(entry => (
              <div key={entry.key} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-2.5">
                <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {entry.status === 'done' && entry.data?.type === 'video' ? (
                    <Video className="w-5 h-5 text-gray-400" />
                  ) : entry.status === 'done' ? (
                    <img src={entry.data.url} alt="" className="w-full h-full object-cover" />
                  ) : entry.status === 'error' ? (
                    <span className="text-[10px] text-red-500 text-center px-1">Failed</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-sky-600 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate dark:text-white">{entry.file.name}</p>
                  {entry.status === 'done' && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {CATEGORIES.map(c => (
                        <button key={c} onClick={() => setCategoryFor(entry.key, c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${entry.category === c ? 'bg-sky-600 border-sky-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                          {entry.category === c && <Check className="w-3 h-3" />} {c}
                        </button>
                      ))}
                    </div>
                  )}
                  {entry.status === 'error' && <p className="text-xs text-red-500 mt-0.5">Upload failed</p>}
                </div>
                <button onClick={() => removePending(entry.key)} title="Remove from this batch"
                  className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={closeReview} disabled={uploadingCount > 0}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white disabled:opacity-50">
              Cancel
            </button>
            <button onClick={saveAll} disabled={saving || doneCount === 0 || uploadingCount > 0}
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : `Add ${doneCount || ''} to Portfolio`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
