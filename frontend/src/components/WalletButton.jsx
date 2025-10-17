// src/components/WalletButton.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';

const API = process.env.REACT_APP_API || 'http://localhost:5000';

function WalletButton({ onAddress, onVerified }) {
  const [addr, setAddr] = useState(localStorage.getItem('wallet') || '');
  const [verified, setVerified] = useState(localStorage.getItem('wallet_verified') === 'true');
  const [busy, setBusy] = useState(false);

  // ---- helpers --------------------------------------------------------------
  const notifyParent = useCallback(() => {
    onAddress?.(addr || '');
    onVerified?.(verified || false);
  }, [addr, verified, onAddress, onVerified]);

  useEffect(() => { notifyParent(); }, [notifyParent]);

  // keep in sync with MetaMask events
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => {
      const a = accounts?.[0] ? ethers.getAddress(accounts[0]) : '';
      setAddr(a);
      if (a) {
        localStorage.setItem('wallet', a);
      } else {
        localStorage.removeItem('wallet');
        localStorage.removeItem('wallet_verified');
        setVerified(false);
      }
    };

    const onChainChanged = () => {
      // simple: just refresh app so providers/signers reset
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener('chainChanged', onChainChanged);
    };
  }, []);

  const doVerify = useCallback(async (provider, address) => {
    const token = localStorage.getItem('token');
    if (!token) return; // skip verify if not logged in

    // 1) Save public wallet
    await fetch(`${API}/user/wallet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ wallet_address: address }),
    });

    // 2) Get nonce
    const nr = await fetch(`${API}/user/wallet/nonce`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { nonce } = await nr.json();

    // 3) Sign + verify
    const signer = await provider.getSigner();
    const message = `Sign to verify wallet with your account. Nonce: ${nonce}`;
    const signature = await signer.signMessage(message);

    const vr = await fetch(`${API}/user/wallet/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, signature }),
    });
    const vj = await vr.json();
    if (!vr.ok) {
      setVerified(false);
      localStorage.setItem('wallet_verified', 'false');
      throw new Error(vj.error || 'Wallet verification failed');
    }
    setVerified(true);
    localStorage.setItem('wallet_verified', 'true');
  }, []);

  // Connect when not connected; otherwise open MetaMask account picker to switch
  const connectOrSwitch = async () => {
    try {
      if (!window.ethereum) return alert('Install MetaMask');
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);

      // If already connected, request permissions to trigger the account picker
      if (addr) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // fallback for older MetaMask
        }
      }

      // Request accounts (opens MetaMask if needed)
      const accounts = await provider.send('eth_requestAccounts', []);
      const a = accounts && accounts[0] ? ethers.getAddress(accounts[0]) : '';
      if (!a) throw new Error('No account selected');

      setAddr(a);
      localStorage.setItem('wallet', a);

      // Optional: (re)verify on every (re)connect
      try {
        await doVerify(provider, a);
      } catch (e) {
        // don’t hard fail the connect flow if verification fails
        console.warn('verify failed:', e?.message || e);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Connect failed');
    } finally {
      setBusy(false);
    }
  };

  const label = addr
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}${verified ? ' ✅' : ''}`
    : 'Connect Wallet';

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      <button
        className="role-btn"
        onClick={connectOrSwitch}
        title={addr ? 'Click to switch wallet' : (verified ? 'Verified wallet' : 'Connect & verify wallet')}
        disabled={busy}
      >
        {busy ? 'Working…' : label}
      </button>

    </div>
  );
}
export default WalletButton