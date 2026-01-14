import { ethers, upgrades, run } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const WitPolyRepo = await ethers.getContractFactory("WitPolyRepo");
    console.log("Deploying WitPolyRepo implementation and proxy...");

    const witPolyRepo = await upgrades.deployProxy(WitPolyRepo, [], {
        initializer: 'initialize',
        kind: 'uups'
    });

    await witPolyRepo.waitForDeployment();
    const address = await witPolyRepo.getAddress();

    console.log("WitPolyRepo Proxy deployed to:", address);

    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(address);
    console.log("Implementation address:", implAddress);

    // Wait for 5 blocks to ensure propagation for verification
    console.log("Waiting for 5 block confirmations...");
    const deploymentTx = witPolyRepo.deploymentTransaction();
    if (deploymentTx) {
        await deploymentTx.wait(5);
    }

    // Verify implementation
    console.log("Verifying implementation contract...");
    try {
        await run("verify:verify", {
            address: implAddress,
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
