import { ethers, run } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const WitPolyRepo = await ethers.getContractFactory("WitPolyRepo");
    console.log("Deploying WitPolyRepo...");

    const witPolyRepo = await WitPolyRepo.deploy();

    await witPolyRepo.waitForDeployment();
    const address = await witPolyRepo.getAddress();

    console.log("WitPolyRepo deployed to:", address);

    // Wait for 5 blocks to ensure propagation for verification
    console.log("Waiting for 5 block confirmations...");
    const deploymentTx = witPolyRepo.deploymentTransaction();
    if (deploymentTx) {
        await deploymentTx.wait(5);
    }

    // Verify contract
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
        console.log("Verification successful!");
    } catch (error: any) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("Contract already verified.");
        } else {
            console.error("Verification failed:", error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
