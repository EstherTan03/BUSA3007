const express = require('express');
const router = express.Router();
const authenticateUser = require('../middleware/authMiddleware');
const { ethers } = require('ethers');

router.get('/me', authenticateUser, (req, res) => res.json({ user: req.user }));

router.put('/wallet', authenticateUser, async (req, res) => {
  try {
    const { address } = req.body;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Wallet must be 42 chars (0x + 40 hex)' });
    }
    const checksum = ethers.getAddress(address); // throws if invalid
    req.user.wallet_address = checksum.toLowerCase();
    await req.user.save();
    res.json({ ok: true, wallet_address: req.user.wallet_address });
  } catch {
    res.status(400).json({ error: 'Invalid wallet address' });
  }
});

module.exports = router;
