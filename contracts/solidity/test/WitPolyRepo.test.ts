import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { WitPolyRepo } from "../typechain-types";

describe("WitPolyRepo", function () {
    let witPolyRepo: any; // Type 'any' due to proxy wrapper
    let owner: any;
    let otherAccount: any;
    let collaborator: any;

    beforeEach(async function () {
        [owner, otherAccount, collaborator] = await ethers.getSigners();
        const WitPolyRepoParams = await ethers.getContractFactory("WitPolyRepo");
        // Deploy UUPS Proxy
        witPolyRepo = await upgrades.deployProxy(WitPolyRepoParams, [], { initializer: 'initialize', kind: 'uups' });
    });

    it("Should create a repository", async function () {
        const tx = await witPolyRepo.createRepo("TestRepo", "Description", true);
        await tx.wait();

        const repo = await witPolyRepo.repositories(1);
        expect(repo.name).to.equal("TestRepo");
        expect(repo.owner).to.equal(owner.address);
        expect(repo.id).to.equal(1n);
    });

    it("Should update head", async function () {
        await witPolyRepo.createRepo("TestRepo", "Desc", true);

        // Update head
        await witPolyRepo.updateHead(
            1,
            "commit_cid",
            "manifest_cid",
            "quilt_id",
            "root_hash",
            0, // expected version
            "parent_cid"
        );

        const repo = await witPolyRepo.repositories(1);
        expect(repo.version).to.equal(1n);
        expect(repo.headCommitCid).to.equal("commit_cid");
    });

    it("Should enforce ACL on updateHead", async function () {
        await witPolyRepo.createRepo("TestRepo", "Desc", true);

        await expect(
            witPolyRepo.connect(otherAccount).updateHead(
                1, "c", "m", "q", "r", 0, "p"
            )
        ).to.be.revertedWith("WitPolyRepo: Access denied");
    });

    it("Should verify hasAccess for Lit Action", async function () {
        await witPolyRepo.createRepo("PrivateRepo", "Desc", true);
        await witPolyRepo.createRepo("PublicRepo", "Desc", false);

        // Owner check
        expect(await witPolyRepo.hasAccess(1, owner.address)).to.be.true;

        // Non-collaborator on private repo
        expect(await witPolyRepo.hasAccess(1, otherAccount.address)).to.be.false;

        // Collaborator check
        await witPolyRepo.addCollaborator(1, collaborator.address);
        expect(await witPolyRepo.hasAccess(1, collaborator.address)).to.be.true;

        // Public repo (assuming current logic returns true if !isPrivate)
        expect(await witPolyRepo.hasAccess(2, otherAccount.address)).to.be.true;
    });
});
