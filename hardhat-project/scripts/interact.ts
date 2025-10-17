import { network } from "hardhat"; 
import { expect } from "chai"; 
const {ethers} = await network.connect();
import { Contract } from "ethers";

async function main() {
    const deedAddress = "0x58A4760761370a21d48c5c8B03Af212b62965881";
    const escrowAddress = "0x910DC5c1DA6819Cc27682b31F4C3e19Db8EED6fD";


    const PropertyDeed = await ethers.getContractFactory("PropertyDeed");
    const deed = await PropertyDeed.attach(deedAddress);

    const PropertyEscrow = await ethers.getContractFactory("PropertyEscrow");
    const escrow = await PropertyEscrow.attach(escrowAddress);

    // Example: Mint a property deed to buyer
    const [buyer, seller] = await ethers.getSigners();
    await deed.mintDeed(buyer.address, "1");
    console.log("Deed minted to buyer:", buyer.address);

    // Example: Approve escrow to manage deed
    await deed.connect(buyer).approve(escrowAddress, "1");
    console.log("Escrow approved to manage deed #1");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
