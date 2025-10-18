// frontend/src/web3.js
import { ethers } from "ethers";
import EscrowAbi from "./abi/PropertyEscrow.json";
import DeedAbi from "./abi/PropertyDeed.json";
import { DEFAULT_DEED, DEFAULT_ESCROW } from "./address";

// Re-export convenient names if you want to import from here too
export const DEFAULT_DEED_ADDRESS = DEFAULT_DEED;
export const DEFAULT_ESCROW_ADDRESS = DEFAULT_ESCROW;

export function getBrowserProvider() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = getBrowserProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

// Generic helpers used by PropertyCard
export async function assertContractCode(address) {
  const provider = getBrowserProvider();
  const code = await provider.getCode(address);
  if (!code || code === "0x") throw new Error(`No contract at ${address}`);
}

export async function getEscrowContract(address) {
  const signer = await getSigner();
  return new ethers.Contract(address, EscrowAbi.abi || EscrowAbi, signer);
}

export async function getDeedContract(address) {
  const signer = await getSigner();
  return new ethers.Contract(address, DeedAbi.abi || DeedAbi, signer);
}

// Returns the function name for 'list' (kept as a helper to match your component)
export function fnList(contract) {
  if (typeof contract.list === "function") return "list";
  // If your ABI used a different label, add branches here.
  throw new Error("Escrow ABI missing list(...)");
}

// Optional: keep your previous helper for other components
export async function getEscrowWithSigner() {
  const signer = await getSigner();
  return new ethers.Contract(DEFAULT_ESCROW, EscrowAbi.abi || EscrowAbi, signer);
}
