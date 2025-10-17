// src/components/PropertyCard.jsx
import React, { useMemo, useState } from 'react';
import './PropertyCard.css';
import { ethers } from 'ethers';
import {
  getDeedContract,
  getEscrowContract,
  assertContractCode,
  fnList,
  DEFAULT_DEED_ADDRESS,
  DEFAULT_ESCROW_ADDRESS,
} from '../web3';

const API = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function PropertyCard({ property = {}, currentWallet: walletFromProp }) {
  const {
    _id,
    imageURL,
    imageUrl,
    location = 'Unknown',
    seller_name = 'N/A',
    seller_address = '',
    num_of_rooms = 0,
    num_of_bedroom = 0,
    price_in_ETH = 0,

    // prefer per-listing values if present
    deed_address: deedAddrFromDb,
    escrow_address: escrowAddrFromDb,
    tokenId: tokenIdFromDb,
    dealId: dealIdFromDb,
  } = property;

  // resolve addresses & ids with fallbacks
  const deedAddr = deedAddrFromDb || DEFAULT_DEED_ADDRESS;
  const escrowAddr = escrowAddrFromDb || DEFAULT_ESCROW_ADDRESS;
  const tokenId = tokenIdFromDb ?? 1;

  // local UI state
  const [displayUrl, setDisplayUrl] = useState(imageURL || imageUrl || '');
  const [price, setPrice] = useState(price_in_ETH);
  const [imgError, setImgError] = useState(false);

  // edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [file, setFile] = useState(null);
  const [formPrice, setFormPrice] = useState(String(price ?? ''));

  // escrow state
  const [dealId, setDealId] = useState(dealIdFromDb ?? null);
  const [txMsg, setTxMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // who’s viewing? (seller vs buyer)
  const currentWallet = walletFromProp || localStorage.getItem('wallet') || '';
  const isSellerViewing = useMemo(() => {
    if (!currentWallet || !seller_address) return false;
    try { return ethers.getAddress(currentWallet) === ethers.getAddress(seller_address); }
    catch { return false; }
  }, [currentWallet, seller_address]);

  // ---------- SELLER: approve + list ----------
  const approveAndList = async () => {
    try {
      if (!isSellerViewing) { setTxMsg('⚠️ Only seller can list'); return; }
      if (!deedAddr || !escrowAddr) { setTxMsg('⚠️ Missing contract addresses'); return; }

      setBusy(true);
      setTxMsg('⏳ Checking contracts…');

      // guard wrong network / bad address
      await assertContractCode(deedAddr);
      await assertContractCode(escrowAddr);

      const deed = await getDeedContract(deedAddr);

      // approve escrow for this token if needed
      const approved = await deed.getApproved(ethers.toBigInt(tokenId));
      if (!approved || approved.toLowerCase() !== escrowAddr.toLowerCase()) {
        setTxMsg('⏳ Approving escrow to transfer your token…');
        const tx1 = await deed.approve(escrowAddr, ethers.toBigInt(tokenId));
        await tx1.wait();
      }

      // list on escrow
      const escrow = await getEscrowContract(escrowAddr);
      const listName = fnList(escrow); // throws if ABI mismatch

      setTxMsg('⏳ Listing on escrow…');
      const priceWei = ethers.parseEther(String(price_in_ETH ?? '0'));
      const tx2 = await escrow[listName](deedAddr, tokenId, priceWei);
      const rcpt = await tx2.wait();

      // try to extract a dealId from any event containing "deal"
      let newId = null;
      try {
        const log = rcpt.logs?.find(l => (l.fragment?.name || '').toLowerCase().includes('deal'));
        newId = log?.args?.dealId ? Number(log.args.dealId) : null;
      } catch {}

      // persist so buyers don’t see “must list” after refresh
      if (newId != null) {
        setDealId(newId);
        await fetch(`${API}/property/${_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: newId, escrow_address: escrowAddr, deed_address: deedAddr })
        });
        setTxMsg(`✅ Listed (Deal ID: ${newId}). Buyer can press Buy.`);
      } else {
        setTxMsg('✅ Listed. (Could not parse dealId from events — consider adding a getter to your contract.)');
      }
    } catch (e) {
      console.error(e);
      setTxMsg(`❌ ${e.shortMessage || e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ---------- BUYER: one-click Buy ----------
  const buyNow = async () => {
    try {
      if (dealId == null) { setTxMsg('⚠️ Seller must list on escrow first'); return; }

      setBusy(true);
      setTxMsg('⏳ Preparing…');

      await assertContractCode(escrowAddr); // guard wrong network / bad address
      const escrow = await getEscrowContract(escrowAddr);

      const valueWei = ethers.parseEther(String(price_in_ETH ?? '0'));
      // adjust if your function is named depositEarnest instead
      const tx = await escrow.deposit(dealId, { value: valueWei });
      await tx.wait();

      setTxMsg('✅ Payment deposited to escrow.');
    } catch (e) {
      console.error(e);
      setTxMsg(`❌ ${e.shortMessage || e.message || 'Buy failed'}`);
    } finally {
      setBusy(false);
    }
  };

  // ---------- Edit (image + price) ----------
  const openEdit = () => {
    setMsg('');
    setFormUrl('');
    setFile(null);
    setFormPrice(String(price ?? ''));
    setShowEdit(true);
  };

  const onUrlChange = (e) => {
    setFormUrl(e.target.value);
    if (e.target.value) setFile(null);
  };
  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setFormUrl('');
  };

  const saveChanges = async (e) => {
    e.preventDefault();
    setMsg('');
    const token = localStorage.getItem('token');
    if (!token) return setMsg('Please login first.');

    // price (optional)
    let pricePayload;
    const p = String(formPrice || '').trim();
    if (p) {
      if (!/^\d+(\.\d+)?$/.test(p)) return setMsg('Price must be a number (e.g., 0.05)');
      if (Number(p) <= 0) return setMsg('Price must be > 0');
      pricePayload = Number(p);
    }

    // image (optional)
    let finalUrl = formUrl.trim();
    if (!finalUrl && file) {
      const fd = new FormData();
      fd.append('image', file);
      const up = await fetch(`${API}/upload/image`, { method: 'POST', body: fd });
      const upData = await up.json();
      if (!up.ok) return setMsg(upData.error || 'Image upload failed');
      finalUrl = `${API}${upData.url}`;
    }
    if (finalUrl && !/^https?:\/\/.+/i.test(finalUrl)) {
      return setMsg('Image URL must start with http(s)://');
    }
    if (!finalUrl && pricePayload === undefined) {
      return setMsg('Nothing to update');
    }

    try {
      setSaving(true);
      const body = {};
      if (pricePayload !== undefined) body.price_in_ETH = pricePayload;
      if (finalUrl) body.imageUrl = finalUrl;

      const res = await fetch(`${API}/property/${_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaving(false); return setMsg(data.error || 'Update failed'); }

      if (pricePayload !== undefined) setPrice(pricePayload);
      if (finalUrl) { setDisplayUrl(finalUrl); setImgError(false); }

      setMsg('✅ Updated');
      setTimeout(() => setShowEdit(false), 600);
    } catch {
      setMsg('Network error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI ----------
  const imgSrc = displayUrl;
  const priceStr = String(price ?? '0');

  const buyerButtons = (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <button
        onClick={buyNow}
        disabled={busy}
        style={{ height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', background: '#111827', color: '#fff' }}
      >
        {busy ? 'Processing…' : `Buy for ${priceStr} ETH`}
      </button>
      {dealId == null && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Seller must list on escrow first.
        </div>
      )}
    </div>
  );

  const sellerButtons = (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <button
        type="button"
        onClick={openEdit}
        disabled={busy}
        style={{ height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', background: '#fff', color: '#111827' }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={approveAndList}
        disabled={busy || dealId != null}
        title={dealId != null ? 'Already listed' : ''}
        style={{
          height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,.12)',
          background: dealId != null ? '#9ca3af' : '#111827', color: '#fff'
        }}
      >
        {busy ? 'Processing…' : (dealId == null ? 'List on Escrow' : 'Listed')}
      </button>
    </div>
  );

  return (
    <article className="prop-card">
      <div className="prop-card__image">
        {imgSrc && !imgError ? (
          <img src={imgSrc} alt={location || 'Property'} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div style={{
            width: '100%', height: 220, borderTopLeftRadius: 16, borderTopRightRadius: 16,
            background: '#f3f4f6', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 14
          }}>
            No image
          </div>
        )}
      </div>

      <div className="prop-card__body">
        <h3 className="prop-card__title">{location}</h3>
        <dl className="prop-card__meta">
          <div className="prop-card__row"><dt>Seller</dt><dd>{seller_name}</dd></div>
          <div className="prop-card__row"><dt>Rooms</dt><dd>{num_of_rooms}</dd></div>
          <div className="prop-card__row"><dt>Bedrooms</dt><dd>{num_of_bedroom}</dd></div>
          <div className="prop-card__row"><dt>Price (ETH)</dt><dd>{priceStr}</dd></div>
          {dealId != null && <div className="prop-card__row"><dt>Deal ID</dt><dd>{dealId}</dd></div>}
          <div className="prop-card__row"><dt>Token ID</dt><dd>{tokenId}</dd></div>
        </dl>

        {isSellerViewing ? sellerButtons : buyerButtons}

        {txMsg && (
          <p style={{ marginTop: 8, fontSize: 13, color: txMsg.startsWith('✅') ? 'green' : '#2563eb' }}>
            {txMsg}
          </p>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div
          onClick={() => !saving && setShowEdit(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}
          >
            <h4 style={{ marginBottom: 12 }}>Edit Property</h4>
            <form onSubmit={saveChanges} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280' }}>Price (ETH)</label>
              <input
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="e.g., 0.05"
                inputMode="decimal"
                style={{ padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />

              <label style={{ fontSize: 12, color: '#6b7280' }}>Image URL (or upload below)</label>
              <input
                placeholder="https://..."
                value={formUrl}
                onChange={onUrlChange}
                disabled={!!file}
                style={{ padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #e5e7eb', opacity: file ? 0.6 : 1 }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={!!formUrl}
                style={{ padding: 10, fontSize: 14, borderRadius: 8, border: '1px solid #e5e7eb', opacity: formUrl ? 0.6 : 1 }}
              />

              {msg && (
                <div style={{ color: msg.startsWith('✅') ? 'green' : 'crimson', fontWeight: 600 }}>
                  {msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff', border: '1px solid #111827', cursor: 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowEdit(false)}
                  style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}

export default PropertyCard;
