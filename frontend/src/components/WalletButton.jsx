// WalletButton.jsx
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';

export default function WalletButton({ onAddress }) {
  const [account, setAccount] = useState(null);
  const hasMM = typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;

  const connect = async () => {
    if (!hasMM) return; // show install UI instead
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xE708' }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xE708',
            chainName: 'Linea Mainnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://linea-mainnet.infura.io/v3/df4c2f5aa43949f989387df5a7a77826'],
            blockExplorerUrls: ['https://lineascan.build/'],
          }],
        });
      } else {
        alert(e.message || 'Failed to switch network');
        return;
      }
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const selected = ethers.getAddress(accounts[0]);
    setAccount(selected);
    localStorage.setItem('wallet', selected);
    onAddress?.(selected);
  };

  useEffect(() => {
    if (!hasMM) return;
    const onAcc = (accs) => {
      const addr = accs.length ? ethers.getAddress(accs[0]) : null;
      setAccount(addr);
      if (addr) {
        localStorage.setItem('wallet', addr);
        onAddress?.(addr);
      } else {
        localStorage.removeItem('wallet');
        onAddress?.(null);
      }
    };
    window.ethereum.on('accountsChanged', onAcc);
    return () => window.ethereum.removeListener('accountsChanged', onAcc);
  }, [hasMM, onAddress]);

  if (!hasMM) {
    return (
      <a
        className="role-btn buyer"
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        title="Install MetaMask"
      >
        Install MetaMask
      </a>
    );
  }

  return account ? (
    <button className="role-btn seller" title={account}>
      {account.slice(0, 6)}…{account.slice(-4)}
    </button>
  ) : (
    <button className="role-btn buyer" onClick={connect}>
      Connect Wallet
    </button>
  );
}
