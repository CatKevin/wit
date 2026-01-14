// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract WitPolyRepo is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct Repository {
        uint256 id;
        string name;
        string description;
        bool isPrivate;
        address owner;
        uint64 version;
        
        string headCommitCid;
        string headManifestCid;
        string headQuiltId;
        string rootHash;
        string parentCommitCid; // To verify lineage
    }

    uint256 private _nextRepoId;
    mapping(uint256 => Repository) public repositories;
    mapping(uint256 => mapping(address => bool)) public collaborators;

    event RepositoryCreated(uint256 indexed repoId, address indexed owner, string name);
    event HeadUpdated(uint256 indexed repoId, uint64 newVersion, string commitCid);
    event CollaboratorAdded(uint256 indexed repoId, address indexed user);
    event CollaboratorRemoved(uint256 indexed repoId, address indexed user);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _nextRepoId = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Create a new repository.
     */
    function createRepo(string memory name, string memory description, bool isPrivate) public returns (uint256) {
        uint256 repoId = _nextRepoId++;
        Repository storage repo = repositories[repoId];
        repo.id = repoId;
        repo.name = name;
        repo.description = description;
        repo.isPrivate = isPrivate;
        repo.owner = msg.sender;
        repo.version = 0;

        emit RepositoryCreated(repoId, msg.sender, name);
        return repoId;
    }

    /**
     * @dev Update the head commit of a repository.
     * Enforces strict versioning (expectedVersion matches current version).
     */
    function updateHead(
        uint256 repoId,
        string memory newCommitCid,
        string memory newManifestCid,
        string memory newQuiltId,
        string memory newRootHash,
        uint64 expectedVersion,
        string memory parentCommitCid
    ) public {
        require(_hasWriteAccess(repoId, msg.sender), "WitPolyRepo: Access denied");
        Repository storage repo = repositories[repoId];
        require(repo.version == expectedVersion, "WitPolyRepo: Version mismatch");
        
        // Basic lineage check: verify parent matches current head (unless genesis)
        if (repo.version > 0) {
            require(keccak256(bytes(repo.headCommitCid)) == keccak256(bytes(parentCommitCid)), "WitPolyRepo: Invalid parent commit");
        }

        repo.headCommitCid = newCommitCid;
        repo.headManifestCid = newManifestCid;
        repo.headQuiltId = newQuiltId;
        repo.rootHash = newRootHash;
        repo.parentCommitCid = parentCommitCid; // Store parent for future ref
        repo.version++;

        emit HeadUpdated(repoId, repo.version, newCommitCid);
    }

    /**
     * @dev Check if a user has access to a repository.
     * For MVP: Owner always has access. Collaborators have access.
     * Use this for Lit Actions.
     */
    function hasAccess(uint256 repoId, address user) public view returns (bool) {
        Repository storage repo = repositories[repoId];
        if (repo.id == 0) return false; // Repo does not exist
        if (repo.owner == user) return true;
        if (collaborators[repoId][user]) return true;
        // If public, everyone has read access? Lit Condition usually checks for decryption authorization.
        // If repo is private, only owner/collaborators.
        // If repo is public, maybe we return true? 
        // For 'push' (write), we need write access. 
        // For 'pull/clone' (read), if private -> check; if public -> true.
        // But Lit Action usually gates encryption keys, so it implies "has decryption access".
        if (!repo.isPrivate) return true;
        
        return false;
    }

    /**
     * @dev Internal helper to check write access.
     * Currently only Owner and Collaborators have write access.
     */
    function _hasWriteAccess(uint256 repoId, address user) internal view returns (bool) {
        Repository storage repo = repositories[repoId];
        if (repo.owner == user) return true;
        if (collaborators[repoId][user]) return true;
        return false;
    }

    // --- ACL Management (MVP) ---

    function addCollaborator(uint256 repoId, address user) public {
        require(repositories[repoId].owner == msg.sender, "WitPolyRepo: Only owner");
        if (!collaborators[repoId][user]) {
            collaborators[repoId][user] = true;
            emit CollaboratorAdded(repoId, user);
        }
    }

    function removeCollaborator(uint256 repoId, address user) public {
        require(repositories[repoId].owner == msg.sender, "WitPolyRepo: Only owner");
        if (collaborators[repoId][user]) {
            collaborators[repoId][user] = false;
            emit CollaboratorRemoved(repoId, user);
        }
    }
}
