import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import WalletButton from './WalletButton';

const API_BASE = 'http://localhost:5000';

const Header = () => {
  const [name, setUsername] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef();
  const [wallet, setWallet] = useState(null);

  // ---- Modal & form state ----
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    seller_name: '',
    num_of_rooms: '',
    num_of_bedroom: '',
    location: '',
    price_in_ETH: '',
    imageUrl: '',
    imageFile: null,
    seller_address: '',
  });

  // Derived flags for image fields
  const hasUrl = !!String(form.imageUrl || '').trim();
  const hasFile = !!form.imageFile;

  // Fetch current user for header + prefill seller name
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchUserName = async () => {
      try {
        const response = await fetch(`${API_BASE}/property/protected`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok && data.user?.name) {
          setUsername(data.user.name);
          localStorage.setItem('name', data.user.name);
          // Prefill seller name in modal
          setForm(f => ({ ...f, seller_name: data.user.name || '' }));
        } else {
          setUsername(null);
          localStorage.removeItem('token');
          localStorage.removeItem('name');
          navigate('/login');
        }
      } catch {
        setUsername(null);
        localStorage.removeItem('token');
        localStorage.removeItem('name');
        navigate('/login');
      }
    };
    fetchUserName();
  }, [navigate]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep modal address synced with connected wallet (read-only display)
  useEffect(() => {
    setForm((f) => ({ ...f, seller_address: wallet || localStorage.getItem('wallet') || '' }));
  }, [wallet]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    localStorage.removeItem('username');
    setUsername(null);
    navigate('/login');
  };

  // Open modal directly (no role toggle)
  const openCreateModal = () => {
    setMsg('');
    const currentName = localStorage.getItem('name') || name || '';
    const currentWallet = wallet || localStorage.getItem('wallet') || '';
    setForm(f => ({
      ...f,
      seller_name: currentName,
      seller_address: currentWallet,
      // keep previously typed fields if any
    }));
    setShowCreate(true);
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Image URL change: if user starts typing a URL, clear file and disable it
  const onImageUrlChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, imageUrl: val, imageFile: val ? null : f.imageFile }));
  };

  // File change: if user picks a file, clear URL and disable it
  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm(f => ({ ...f, imageFile: file, imageUrl: file ? '' : f.imageUrl }));
  };

  const createProperty = async (e) => {
    e.preventDefault();
    setMsg('');
    const token = localStorage.getItem('token');
    if (!token) return setMsg('Please login first.');

    // All fields required (except imageUrl/imageFile: at least one)
    if (!form.seller_name) return setMsg('Seller name is required.');
    if (!form.location) return setMsg('Location is required.');
    if (!String(form.num_of_rooms).trim() || !/^\d+$/.test(String(form.num_of_rooms))) {
      return setMsg('Rooms is required and must be an integer.');
    }
    if (!String(form.num_of_bedroom).trim() || !/^\d+$/.test(String(form.num_of_bedroom))) {
      return setMsg('Bedrooms is required and must be an integer.');
    }
    if (!String(form.price_in_ETH).trim() || !/^\d+(\.\d+)?$/.test(String(form.price_in_ETH))) {
      return setMsg('Price (ETH) is required and must be a number (e.g. 0.05).');
    }

    // Image rule: either URL or file must be provided
    if (!hasUrl && !hasFile) {
      return setMsg('Please provide an Image URL or upload an image file.');
    }

    // If URL provided, validate it
    if (hasUrl && !/^https?:\/\/.+/i.test(String(form.imageUrl))) {
      return setMsg('Image URL must start with http(s)://');
    }

    try {
      setSubmitting(true);

      // Resolve final image URL (upload file if provided)
      let imageUrlToUse = String(form.imageUrl || '').trim();

      if (!imageUrlToUse && hasFile) {
        const fd = new FormData();
        fd.append('image', form.imageFile);
        const up = await fetch(`${API_BASE}/upload/image`, { method: 'POST', body: fd });
        const upData = await up.json();
        if (!up.ok) {
          setSubmitting(false);
          return setMsg(upData.error || 'Image upload failed');
        }
        // Make absolute URL so frontend can render it anywhere
        imageUrlToUse = `${API_BASE}${upData.url}`;
      }

      // Create property
      const res = await fetch(`${API_BASE}/property/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          seller_name: form.seller_name,
          num_of_rooms: Number(form.num_of_rooms),
          num_of_bedroom: Number(form.num_of_bedroom),
          location: form.location,
          price_in_ETH: Number(form.price_in_ETH),
          imageUrl: imageUrlToUse,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        return setMsg(data.error || 'Create failed');
      }

      setMsg('✅ Property created!');
      setForm({
        seller_name: localStorage.getItem('name') || name || '',
        num_of_rooms: '',
        num_of_bedroom: '',
        location: '',
        price_in_ETH: '',
        imageUrl: '',
        imageFile: null,
        seller_address: wallet || localStorage.getItem('wallet') || '',
      });
      setTimeout(() => { setShowCreate(false); setMsg(''); }, 900);
    } catch {
      setMsg('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="header">
      <h2 className="brand">Project Name</h2>

      <div className="header-right">
        {/* Open modal */}
        <button
          type="button"
          className="role-btn"
          onClick={openCreateModal}
          title="Create a new property"
        >
          Sell Property
        </button>

        <WalletButton onAddress={(addr) => setWallet(addr)} />

        <div className="profile-section" ref={dropdownRef}>
          <img
            src="/profile.png"
            alt="Profile"
            className="profile"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: 'pointer' }}
          />
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-greeting">
                {name ? `Hi, ${name}` : 'Account'}
              </div>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>

      {/* Create Property Modal */}
      {showCreate && (
        <div style={styles.backdrop} onClick={() => !submitting && setShowCreate(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>Create Property</h3>
            <form onSubmit={createProperty} style={styles.form}>
              <input
                name="seller_name"
                placeholder="Seller Name"
                value={form.seller_name}
                onChange={() => {}}
                readOnly
                style={{ ...styles.input, background: '#f3f4f6', color: '#374151' }}
                title="Taken from your account name"
              />
              <div style={styles.row}>
                <input
                  name="num_of_rooms"
                  placeholder="Rooms"
                  value={form.num_of_rooms}
                  onChange={onChange}
                  required
                  style={{ ...styles.input, flex: 1 }}
                  inputMode="numeric"
                />
                <input
                  name="num_of_bedroom"
                  placeholder="Bedrooms"
                  value={form.num_of_bedroom}
                  onChange={onChange}
                  required
                  style={{ ...styles.input, flex: 1 }}
                  inputMode="numeric"
                />
              </div>
              <input
                name="location"
                placeholder="Location"
                value={form.location}
                onChange={onChange}
                required
                style={styles.input}
              />
              <input
                name="price_in_ETH"
                placeholder="Price (ETH)"
                value={form.price_in_ETH}
                onChange={onChange}
                required
                style={styles.input}
                inputMode="decimal"
              />

              {/* Image URL OR File (mutually exclusive) */}
              <input
                name="imageUrl"
                placeholder="Image URL (https://...)"
                value={form.imageUrl}
                onChange={onImageUrlChange}
                disabled={hasFile}
                style={{ ...styles.input, opacity: hasFile ? 0.6 : 1 }}
                title={hasFile ? 'Disabled because a file is selected' : 'Paste a public image URL'}
              />
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={hasUrl}
                style={{ ...styles.input, opacity: hasUrl ? 0.6 : 1 }}
                title={hasUrl ? 'Disabled because an image URL is provided' : 'Upload an image file'}
              />

              {/* Optional preview if a file is selected */}
              {form.imageFile && (
                <img
                  alt="Preview"
                  src={URL.createObjectURL(form.imageFile)}
                  style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }}
                />
              )}

              <input
                name="seller_address"
                placeholder="Seller Wallet (0x…)"
                value={form.seller_address}
                onChange={() => {}}
                readOnly
                style={{ ...styles.input, background: '#f3f4f6', color: '#374151' }}
                title="Taken from your connected wallet"
              />

              {msg && (
                <div style={{ color: msg.startsWith('✅') ? 'green' : 'crimson', fontWeight: 600 }}>
                  {msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" disabled={submitting} style={styles.primary}>
                  {submitting ? 'Creating…' : 'Create'}
                </button>
                <button type="button" disabled={submitting} onClick={() => setShowCreate(false)} style={styles.ghost}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 50 },
  modal: { width: 420, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,.25)' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', gap: 10 },
  input: { padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #e5e7eb' },
  primary: { padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff', border: '1px solid #111827', cursor: 'pointer' },
  ghost: { padding: '10px 12px', borderRadius: 8, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', cursor: 'pointer' },
};

export default Header;
