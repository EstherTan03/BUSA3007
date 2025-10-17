import { network } from "hardhat"; 
import { expect } from "chai"; 
const {ethers} = await network.connect();
import { Contract } from "ethers";

async function main() {
    const deedAddress = "0xbF4a6C5586112648C8dCe3703C3126b04B1f430C";
    const escrowAddress = "0xa9166bc54e44b2400E5cE631265EaD64A5b8051b";
  // Print all available signers
    const signers = await ethers.getSigners();
    console.log("Available accounts:");
    signers.forEach((s, i) => {
    console.log(`Signer[${i}]: ${s.address}`);
  });

  // Pick seller and buyer from the list
    const seller = signers[0];
    const buyer = signers[1]; // make sure different accounts

    console.log("Selected Seller:", seller.address);
    console.log("Selected Buyer:", buyer.address);

    const PropertyDeed = await ethers.getContractFactory("PropertyDeed");
    const deed = await PropertyDeed.attach(deedAddress);

    const PropertyEscrow = await ethers.getContractFactory("PropertyEscrow");
    const escrow = await PropertyEscrow.attach(escrowAddress);

    const tokenId = "1"; // matches minted deed
    const price = ethers.parseEther("1"); // 1 ETH
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // --------------------------
    // Step 1: Mint deed to seller
    // --------------------------
    await deed.mintDeed(seller.address, tokenId);
    console.log(`Deed minted to seller: ${seller.address}, tokenId: ${tokenId}`);

    // --------------------------
    // Step 2: Approve escrow
    // --------------------------
    await deed.connect(seller).approve(escrowAddress, tokenId);
    console.log(`Escrow approved to manage deed #${tokenId}`);

    // --------------------------
    // Step 3: Seller lists property
    // --------------------------
    await escrow.connect(seller).list(tokenId, price, deadline);
    console.log(`Property #${tokenId} listed for ${ethers.formatEther(price)} ETH`);

    // --------------------------
    // Step 4: Buyer deposits payment
    // --------------------------
    await escrow.connect(buyer).deposit(tokenId, { value: price });
    console.log(`Buyer deposited ${ethers.formatEther(price)} ETH for property #${tokenId}`);

    // --------------------------
    // Step 5: Buyer confirms deal
    // --------------------------
    await escrow.connect(buyer).buyerConfirm(tokenId);
    console.log(`Buyer confirmed property #${tokenId}`);

    // --------------------------
    // Step 6: Seller confirms deal
    // --------------------------
    await escrow.connect(seller).sellerConfirm(tokenId);
    console.log(`Seller confirmed property #${tokenId}`);

    // --------------------------
    // Step 7: Finalize transaction
    // --------------------------
    await escrow.finalize(tokenId);
    console.log(`Transaction finalized for property #${tokenId}`);

    // --------------------------
    // Step 8: Verify ownership
    // --------------------------
    const newOwner = await deed.ownerOf(tokenId);
    console.log(`New owner of property #${tokenId} is: ${newOwner}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
