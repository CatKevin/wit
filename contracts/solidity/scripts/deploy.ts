import { ethers, upgrades } from "hardhat";

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

    // Implementation address validation (optional, helpful for verifying)
    const implAddress = await upgrades.erc1967.getImplementationAddress(address);
    console.log("Implementation address:", implAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
